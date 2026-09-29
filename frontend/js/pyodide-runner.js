/* PyRunner：主线程访问 Pyodide 的唯一入口。
 *
 * - Python 全部跑在 Web Worker 里，死循环/超时直接 terminate 重建；
 * - 优先本地 vendor，加载失败自动回退 CDN（仅一次）；
 * - judge / bench 返回已在 JS 侧整理好的普通对象，视图不关心 Pyodide 细节。
 *
 * 超时分两段：引擎首次要下载/编译十几 MB WASM，这段算"加载"，
 * 用宽松的 ENGINE_LOAD_TIMEOUT；引擎就绪后只按代码执行时长卡。
 * 否则冷启动慢一点就会被误判成"死循环超时"。
 */
const PyRunner = (() => {
  const LOCAL_URL = "/vendor/pyodide/";
  const CDN_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

  const ENGINE_LOAD_TIMEOUT = 90000; // 首次加载/编译引擎
  const JUDGE_TIMEOUT = 12000;       // 判题代码执行
  const BENCH_TIMEOUT = 120000;      // 性能实测（多解法 × 多规模）
  const DEMO_TIMEOUT = 12000;        // 知识点操作示例

  let worker = null;
  let seq = 0;
  const pending = new Map();
  const statusListeners = [];
  let status = "idle";       // idle | loading | ready
  let indexUrl = LOCAL_URL;
  let triedCdn = false;
  let engineReady = false;   // 引擎是否已在本 worker 里就绪

  function setStatus(next) {
    status = next;
    statusListeners.forEach((fn) => fn(next));
  }

  function spawn() {
    if (worker) worker.terminate();
    engineReady = false;
    worker = new Worker("/js/pyodide-worker.js?v=20");
    worker.onmessage = onMessage;
    worker.onerror = (e) => {
      rejectAll(e.message || "worker 异常");
    };
  }

  function teardown() {
    if (worker) worker.terminate();
    worker = null;
    engineReady = false;
    setStatus("idle");
  }

  function rejectAll(message) {
    for (const [, p] of pending) {
      clearTimeout(p.timer);
      p.reject(new Error(message));
    }
    pending.clear();
    teardown();
  }

  function onMessage(e) {
    const msg = e.data;
    const p = pending.get(msg.id);
    if (!p) return;

    if (msg.type === "load-error") {
      clearTimeout(p.timer);
      pending.delete(msg.id);
      teardown();
      if (!triedCdn) {
        triedCdn = true;
        indexUrl = CDN_URL;
        p.retry(); // 用 CDN 重发同一请求
      } else {
        p.reject(new Error("Pyodide 加载失败：" + msg.message));
      }
      return;
    }

    clearTimeout(p.timer);
    pending.delete(msg.id);
    if (msg.type === "error") {
      p.reject(new Error(msg.message));
    } else {
      engineReady = true;
      setStatus("ready");
      p.resolve(msg);
    }
  }

  function send(action, payload, execTimeoutMs) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => {
        // teardown 会把 engineReady 清掉，所以先把原因判出来
        const wasReady = engineReady;
        pending.delete(id);
        teardown();
        reject(
          new Error(
            wasReady
              ? "执行超时（可能存在死循环），运行环境已重置"
              : "Python 运行环境加载超时，请检查网络或 vendor/pyodide 目录"
          )
        );
      }, execTimeoutMs);

      const entry = {
        resolve,
        reject,
        timer,
        retry: () => {
          pending.delete(id);
          // 回退 CDN 后要重新走一遍加载，不能再进 ensureReady（会死循环）
          resolve(send(action, payload, ENGINE_LOAD_TIMEOUT));
        },
      };
      pending.set(id, entry);

      if (!engineReady) setStatus("loading");
      if (!worker) spawn();
      worker.postMessage({ id, action, indexUrl, ...payload });
    });
  }

  /* 加载与执行分开计时。
   * 老写法是"引擎没就绪就给这次请求放宽到 90s"——一旦同一批里有多个请求，
   * 第一个跑完把 engineReady 置真，后面的请求就被按纯执行超时（12s）计时，
   * 可它们还排在队列里等着，于是集体超时、worker 被反复重建。
   * 现在先统一把引擎拉起来，再发真正的任务，超时的就只是代码执行本身。
   */
  let readyPromise = null;

  function ensureReady() {
    if (engineReady && worker) return Promise.resolve();
    if (!readyPromise) {
      readyPromise = send("warmup", {}, ENGINE_LOAD_TIMEOUT).then(
        () => { readyPromise = null; },
        (err) => { readyPromise = null; throw err; }
      );
    }
    return readyPromise;
  }

  function post(action, payload, execTimeoutMs) {
    return ensureReady().then(() => send(action, payload, execTimeoutMs));
  }

  /* ---------------- 结果比较 ---------------- */

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
    }
    if (a && b && typeof a === "object") {
      const ka = Object.keys(a);
      const kb = Object.keys(b);
      return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
    }
    return false;
  }

  function unorderedEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    const sa = a.map((v) => JSON.stringify(v)).sort();
    const sb = b.map((v) => JSON.stringify(v)).sort();
    return sa.every((v, i) => v === sb[i]);
  }

  /* ---------------- 对外接口 ---------------- */

  async function judge(problem, code) {
    const reply = await post("judge", { problem, code }, JUDGE_TIMEOUT);
    const payload = JSON.parse(reply.raw);
    const rows = payload.rows || [];

    const cases = rows.map((row) => {
      const ok = !row.error && (row.unordered
        ? unorderedEqual(row.actual, row.expected)
        : deepEqual(row.actual, row.expected));
      return {
        desc: row.desc,
        expected: row.expected,
        actual: row.actual,
        error: row.error || null,
        ok,
      };
    });

    return {
      cases,
      passed: cases.filter((c) => c.ok).length,
      total: cases.length,
      // Python 侧 perf_counter 计时：只含用例执行，不含引擎初始化与进程间往返
      duration_ms: Math.round(payload.ms || 0),
    };
  }

  async function bench(problem, solutions) {
    const reply = await post("bench", { problem, solutions }, BENCH_TIMEOUT);
    return JSON.parse(reply.raw);
  }

  /** 知识点「基本操作」示例：执行一段脚本，返回它的 stdout。 */
  async function demo(code) {
    const reply = await post("demo", { code }, DEMO_TIMEOUT);
    return JSON.parse(reply.raw); // { output, error }
  }

  return {
    onStatus(fn) {
      statusListeners.push(fn);
      fn(status);
    },
    judge,
    bench,
    demo,
  };
})();
