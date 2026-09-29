/* Pyodide Web Worker。
 * 所有 Python 执行都隔离在这里：页面不会被计算卡住，
 * 超时/死循环时主线程可直接 terminate 本 worker 并重建。
 *
 * 三类任务：
 * - 判题 judge：支持两种形态
 *   - 函数题 tests：调用入口函数比对返回值（args_code 支持链表/树输入）
 *   - 类设计题 scenarios：构造对象后按步骤调用方法
 *   两者输出统一的结果行列表（desc/expected/unordered/actual/error），
 *   并附带 {rows, ms} 包装：ms 是 Python 侧 perf_counter 计时的用例执行总耗时。
 * - 性能实测 bench：多解法 × 多规模计时
 * - 示例演示 demo：知识点页的「基本操作」示例，exec 一段脚本并回收 stdout
 */

const JUDGE_PY = `
import json as _json, traceback as _tb, io as _io, time as _time
from contextlib import redirect_stdout as _rso, redirect_stderr as _rse

def _json_default(o):
    if isinstance(o, tuple):
        return list(o)
    if isinstance(o, (set, frozenset)):
        try:
            return sorted(o)
        except TypeError:
            return sorted(o, key=str)
    return str(o)

def _norm(value):
    return _json.loads(_json.dumps(value, ensure_ascii=False, default=_json_default))

_G = {}
_init_error = None
try:
    exec(__setup_code__, _G)
    exec(__user_code__, _G)
    if __adapter_code__:
        exec(__adapter_code__, _G)
except Exception:
    _init_error = _tb.format_exc()

_rows = []

def _record(desc, expected, unordered, fn):
    row = {"desc": desc, "expected": _norm(expected), "unordered": unordered}
    if _init_error is not None:
        row["error"] = _init_error
        _rows.append(row)
        return
    try:
        with _rso(_io.StringIO()), _rse(_io.StringIO()):
            value = fn()
        if "adapt" in _G:
            value = _G["adapt"](value)
        row["actual"] = _norm(value)
    except Exception:
        row["error"] = _tb.format_exc()
    _rows.append(row)

# 计时只覆盖用例执行，不含引擎初始化与主线程往返，口径比 JS performance.now 干净
_t0 = _time.perf_counter()

# ---- 函数题 ----
for _i, _c in enumerate(_json.loads(__cases_json__)):
    def _run(_c=_c):
        if _c.get("args_code"):
            return _G[__entry__](*eval(_c["args_code"], _G))
        return _G[__entry__](*_c["args"])
    _record(_c.get("desc") or f"用例 {_i + 1}",
            _c["expected"], _c.get("unordered", False), _run)

# ---- 类设计题 ----
for _sc in _json.loads(__scenarios_json__):
    _obj = None if _init_error else _G[__entry__](*_sc["init_args"])
    for _st in _sc["steps"]:
        def _srun(_obj=_obj, _st=_st):
            return getattr(_obj, _st["op"])(*_st["args"])
        _label = _st["op"] + "(" + ", ".join(repr(a) for a in _st["args"]) + ")"
        _record(_label, _st.get("expected"), False, _srun)

_t1 = _time.perf_counter()
_json.dumps({"rows": _rows, "ms": (_t1 - _t0) * 1000}, ensure_ascii=False)
`;

/* 性能实测脚本：exec 生成器得到 make_input(n)，
 * 每份解法独立命名空间，perf_counter 在 Python 内计时（更稳）。
 */
const BENCH_PY = `
import json as _json, time as _time, traceback as _tb

_G0 = {}
exec(__setup_code__, _G0)
exec(__gen_code__, _G0)
_sols = _json.loads(__solutions_json__)
_scales = _json.loads(__scales_json__)
_rows = []
for _s in _sols:
    _g = dict(_G0)
    try:
        exec(_s["code"], _g)
        _fn = _g[__entry__]
        for _n in _scales:
            _args = _G0["make_input"](_n)
            _t0 = _time.perf_counter()
            _fn(*_args)
            _t1 = _time.perf_counter()
            _rows.append({"name": _s["name"], "n": _n, "ms": (_t1 - _t0) * 1000})
    except Exception:
        _rows.append({"name": _s["name"], "error": _tb.format_exc()})
_json.dumps(_rows, ensure_ascii=False)
`;

/* 知识点页「基本操作」示例：整段脚本 exec 一次，把 print 的内容收回来。
 * 与判题不同，这里没有期望值比对——示例只是给读者看"跑起来是什么样"，
 * 真实输出与 content 里声明的 output 是否一致由 tests/check_content 在离线校验。
 */
const DEMO_PY = `
import json as _json, io as _io, traceback as _tb
from contextlib import redirect_stdout as _rso

_buf = _io.StringIO()
_err = None
try:
    with _rso(_buf):
        exec(__demo_code__, {})
except Exception:
    _err = _tb.format_exc()
_json.dumps({"output": _buf.getvalue(), "error": _err}, ensure_ascii=False)
`;

/* 任务必须串行：入参是通过 pyodide.globals 传给 Python 的，
 * 两个请求并发时后一个会覆盖前一个的 __user_code__ / __demo_code__，
 * 结果就是"点了三个运行，三个都返回最后一份代码的输出"。
 * 这里用一条 promise 链排队，保证同一时刻只有一个 Python 任务在跑。
 */
let queue = Promise.resolve();

self.onmessage = (e) => {
  const msg = e.data;
  queue = queue.then(() => handle(msg)).catch(() => {});
};

async function handle(msg) {
  try {
    if (pyodide === null) {
      importScripts(msg.indexUrl + "pyodide.js");
      pyodide = await loadPyodide({ indexURL: msg.indexUrl });
    }

    // warmup：只把引擎拉起来就回复，让主线程能把"加载"和"执行"分开计时
    if (msg.action === "warmup") {
      self.postMessage({ id: msg.id, type: "ready" });
    } else if (msg.action === "judge") {
      pyodide.globals.set("__setup_code__", msg.problem.setup_code || "");
      pyodide.globals.set("__user_code__", msg.code);
      pyodide.globals.set("__adapter_code__", msg.problem.result_adapter || "");
      pyodide.globals.set("__cases_json__", JSON.stringify(msg.problem.tests || []));
      pyodide.globals.set(
        "__scenarios_json__",
        JSON.stringify(msg.problem.scenarios || [])
      );
      pyodide.globals.set("__entry__", msg.problem.entry);
      const raw = await pyodide.runPythonAsync(JUDGE_PY);
      self.postMessage({ id: msg.id, type: "judge-result", raw });
    } else if (msg.action === "bench") {
      pyodide.globals.set("__setup_code__", msg.problem.setup_code || "");
      pyodide.globals.set("__gen_code__", msg.problem.bench.generator);
      pyodide.globals.set("__entry__", msg.problem.entry);
      pyodide.globals.set("__solutions_json__", JSON.stringify(msg.solutions));
      pyodide.globals.set("__scales_json__", JSON.stringify(msg.problem.bench.scales));
      const raw = await pyodide.runPythonAsync(BENCH_PY);
      self.postMessage({ id: msg.id, type: "bench-result", raw });
    } else if (msg.action === "demo") {
      pyodide.globals.set("__demo_code__", msg.code);
      const raw = await pyodide.runPythonAsync(DEMO_PY);
      self.postMessage({ id: msg.id, type: "demo-result", raw });
    }
  } catch (err) {
    // pyodide 尚未就绪说明是运行时加载失败，交给主线程决定是否回退 CDN
    self.postMessage({
      id: msg.id,
      type: pyodide === null ? "load-error" : "error",
      message: String((err && err.message) || err),
    });
  }
}

let pyodide = null;
