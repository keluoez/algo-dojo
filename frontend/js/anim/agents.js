/* Agent 实战动画的算法层：6 个场景的 buildSteps(input) -> Step[]。
 *
 * 与排序脚本同一套协议（纯函数、确定性、只描述"发生了什么"），
 * 只是事件换成了 FOCUS / SET_LIST / SET_METRIC / SCORE / DECIDE / LAYER / WALK / TRIE_ADD
 * ——因为向量检索、路由、工作流、去重这些场景有面板、树、图、决策，
 * 光靠数组下标说不清。
 *
 * 每个构建器末尾都用 SET_LIST 给出最终答案（top / out / layers），
 * 测试拿它与暴力实现比对，保证动画演的和题目答案一致。
 */
import { OP } from "./protocol.js?v=16";

/* ---------------- 1. RAG 向量检索 ---------------- */

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / ((Math.sqrt(na) || 1) * (Math.sqrt(nb) || 1));
}

/* 小顶堆：堆顶是"入围者里最差的"，同分时下标大的更该被淘汰 */
function heapPush(heap, item) {
  heap.push(item);
  heap.sort((x, y) => (x.sim - y.sim) || (y.i - x.i));
}

function heapSnapshot(heap) {
  return [...heap]
    .sort((x, y) => (y.sim - x.sim) || (x.i - y.i))
    .map((e) => ({ i: e.i, sim: e.sim }));
}

export function vectorSearchSteps(vectors, query, k) {
  const steps = [];
  const heap = [];
  steps.push({
    op: OP.NOTE,
    text: `检索开始：库内 ${vectors.length} 条向量，取相似度最高的 ${k} 条`,
  });
  vectors.forEach((v, i) => {
    const sim = cosine(v, query);
    steps.push({
      op: OP.SCORE, i, sim,
      note: `候选 a[${i}]：余弦相似度 = ${sim.toFixed(3)}`,
    });
    steps.push({
      op: OP.FOCUS, ids: [i],
      note: `比对 a[${i}]，相似度 ${sim.toFixed(3)}`,
    });
    if (heap.length < k) {
      heapPush(heap, { i, sim });
      steps.push({
        op: OP.SET_LIST, name: "heap", values: heapSnapshot(heap),
        note: `堆还没满，a[${i}] 直接入围`,
      });
    } else if (sim > heap[0].sim || (sim === heap[0].sim && i < heap[0].i)) {
      const out = heap.shift();
      heapPush(heap, { i, sim });
      steps.push({
        op: OP.SET_LIST, name: "heap", values: heapSnapshot(heap),
        note: `a[${i}]（${sim.toFixed(3)}）打过堆顶 a[${out.i}]（${out.sim.toFixed(3)}），淘汰换入`,
      });
    } else {
      steps.push({
        op: OP.SET_LIST, name: "heap", values: heapSnapshot(heap),
        note: `a[${i}]（${sim.toFixed(3)}）打不过堆顶（${heap[0].sim.toFixed(3)}），落选`,
      });
    }
    steps.push({ op: OP.SET_METRIC, name: "scored", value: i + 1 });
  });
  const ranked = heapSnapshot(heap);
  steps.push({
    op: OP.SET_LIST, name: "top", values: ranked,
    note: `检索完成：Top-${ranked.length} = ${ranked.map((e) => `a[${e.i}]`).join("、")}（相似度降序）`,
  });
  return steps;
}

/* ---------------- 2. 多路召回融合去重 ---------------- */

function mapEntries(best) {
  return Object.keys(best)
    .sort()
    .map((doc) => ({ doc, score: best[doc] }));
}

export function rerankSteps(routes, k) {
  const steps = [];
  const best = {};
  steps.push({ op: OP.NOTE, text: `融合开始：${routes.length} 路召回，取全局 Top-${k}` });
  routes.forEach((route, ri) => {
    route.forEach((row, idx) => {
      const [doc, score] = row;
      steps.push({
        op: OP.FOCUS, ids: [`${ri}:${idx}`],
        note: `第 ${ri + 1} 路：${doc} 分数 ${score}`,
      });
      if (best[doc] === undefined || score > best[doc]) {
        const prev = best[doc];
        best[doc] = score;
        steps.push({
          op: OP.SET_LIST, name: "map", values: mapEntries(best),
          note: prev === undefined
            ? `${doc} 首次出现，记入融合表 = ${score}`
            : `${doc} 取更高分 ${score}（原 ${prev}）`,
        });
      } else {
        steps.push({
          op: OP.SET_LIST, name: "map", values: mapEntries(best),
          note: `${doc} 已有 ${best[doc]} ≥ ${score}，这一路的结果丢弃`,
        });
      }
    });
  });
  const ranked = Object.keys(best)
    .map((doc) => ({ doc, score: best[doc] }))
    .sort((a, b) => (b.score - a.score) || (a.doc < b.doc ? -1 : 1))
    .slice(0, Math.max(0, k));
  steps.push({
    op: OP.SET_LIST, name: "top", values: ranked,
    note: `融合完成：Top-${ranked.length} = ${ranked.map((r) => r.doc).join("、")}`,
  });
  return steps;
}

/* ---------------- 3. 上下文窗口预算裁剪 ---------------- */

export function ctxTrimSteps(messages, budget) {
  const steps = [];
  const kept = new Set();
  const decided = new Set();
  let used = 0;

  steps.push({ op: OP.NOTE, text: `预算 ${budget} tokens：system 必留，其余从最新往回装` });

  messages.forEach((m, i) => {
    if (m.role !== "system") return;
    kept.add(i); decided.add(i); used += m.tokens;
    steps.push({
      op: OP.DECIDE, i, keep: "keep",
      note: `system 消息（${m.tokens} tokens）无条件保留`,
    });
    steps.push({ op: OP.SET_METRIC, name: "used", value: used });
  });

  for (let i = messages.length - 1; i >= 0; i--) {
    if (decided.has(i)) continue;
    const m = messages[i];
    if (used + m.tokens <= budget) {
      kept.add(i); decided.add(i); used += m.tokens;
      steps.push({
        op: OP.DECIDE, i, keep: "keep",
        note: `往回带：消息 ${i}（${m.tokens} tokens）装得下 → 保留（已用 ${used}/${budget}）`,
      });
      steps.push({ op: OP.SET_METRIC, name: "used", value: used });
    } else {
      steps.push({
        op: OP.DECIDE, i, keep: "drop",
        note: `消息 ${i}（${m.tokens} tokens）装不下：${used}+${m.tokens} > ${budget} → 停止回溯`,
      });
      break;                       // 保持"最近的连续对话"，不再往前翻
    }
  }

  for (let i = 0; i < messages.length; i++) {
    if (decided.has(i)) continue;
    steps.push({
      op: OP.DECIDE, i, keep: "drop",
      note: `消息 ${i} 在预算范围之外，丢弃（保持最近一段连续对话）`,
    });
  }

  steps.push({
    op: OP.SET_LIST, name: "out", values: [...kept].sort((a, b) => a - b),
    note: `裁剪完成：保留 ${kept.size}/${messages.length} 条，占用 ${used}/${budget} tokens`,
  });
  return steps;
}

/* ---------------- 4. Trie 最长前缀路由 ---------------- */

function segsOf(path) {
  return path.replace(/^\/+|\/+$/g, "").split("/");
}

export function routerSteps(routes, query) {
  const steps = [];
  steps.push({ op: OP.NOTE, text: `注册 ${routes.length} 条路由前缀，随后匹配 ${query}` });
  routes.forEach((r, idx) => {
    steps.push({
      op: OP.TRIE_ADD, path: r.path, handler: r.handler,
      note: `注册前缀 ${r.path} → ${r.handler}`,
    });
    steps.push({ op: OP.SET_METRIC, name: "rules", value: idx + 1 });
  });

  const segs = segsOf(query);
  let best = null;
  let cur = [];
  segs.forEach((seg, si) => {
    cur = [...cur, seg];
    const hit = routes.find((r) => {
      const rs = segsOf(r.path);
      return rs.length === cur.length && rs.join("/") === cur.join("/");
    });
    if (hit) best = hit.handler;
    steps.push({
      op: OP.WALK, to: [...cur], best,
      note: hit
        ? `下走 "${seg}"：/${cur.join("/")} 有注册点 → 最优更新为 ${hit.handler}`
        : `下走 "${seg}"：/${cur.join("/")} 无注册点，最优仍为 ${best || "无"}`,
    });
    steps.push({ op: OP.SET_METRIC, name: "depth", value: si + 1 });
  });
  steps.push({
    op: OP.FOCUS, ids: [],
    note: best ? `最长前缀匹配：${query} → ${best}` : `${query} 没有匹配到任何前缀`,
  });
  return steps;
}

/* ---------------- 5. 工作流并行分批编排 ---------------- */

export function workflowSteps(tasks, deps) {
  const steps = [];
  const adj = {};
  const indeg = {};
  tasks.forEach((t) => { adj[t] = []; indeg[t] = 0; });
  deps.forEach(([a, b]) => { adj[a].push(b); indeg[b] += 1; });

  steps.push({ op: OP.NOTE, text: `共 ${tasks.length} 个任务，按"入度为 0"分层并行` });
  let done = 0;
  const doneSet = [];
  let batch = tasks.filter((t) => indeg[t] === 0).sort();

  while (batch.length) {
    const layerNo = steps.filter((s) => s.op === OP.LAYER).length + 1;
    steps.push({
      op: OP.FOCUS, ids: [...batch],
      note: `第 ${layerNo} 批可并行：${batch.join("、")}（依赖都已完成）`,
    });
    steps.push({
      op: OP.LAYER, batch: [...batch],
      note: `第 ${layerNo} 批入列：${batch.join("、")} 一起执行`,
    });
    doneSet.push(...batch);
    done += batch.length;
    steps.push({
      op: OP.SET_LIST, name: "done", values: [...doneSet],
      note: `已完成 ${done}/${tasks.length}`,
    });
    const next = new Set();
    batch.forEach((t) => adj[t].forEach((u) => {
      indeg[u] -= 1;
      if (indeg[u] === 0) next.add(u);
    }));
    batch = [...next].sort();
  }

  const layers = steps.filter((s) => s.op === OP.LAYER).length;
  if (done < tasks.length) {
    steps.push({
      op: OP.FOCUS, ids: [],
      note: `还有 ${tasks.length - done} 个任务入度无法归零 → 存在循环依赖，编排失败`,
    });
  } else {
    steps.push({
      op: OP.FOCUS, ids: [],
      note: `编排完成：共 ${layers} 批，批数就是工作流的最少执行轮数`,
    });
  }
  return steps;
}

/* ---------------- 6. URL 归一化去重 ---------------- */

export function normalizeUrl(url) {
  let rest = url.split("#", 1)[0];
  if (rest.includes("?")) {
    const [base, qs] = rest.split("?", 1 + 1);
    const params = qs ? qs.split("&").filter(Boolean).sort() : [];
    rest = params.length ? `${base}?${params.join("&")}` : base;
  }
  const idx = rest.indexOf("://");
  const scheme = idx >= 0 ? rest.slice(0, idx) : "";
  const hostPath = idx >= 0 ? rest.slice(idx + 3) : rest;
  const slash = hostPath.indexOf("/");
  const host = slash >= 0 ? hostPath.slice(0, slash) : hostPath;
  const path = slash >= 0 ? hostPath.slice(slash + 1) : "";
  return `${scheme.toLowerCase()}://${host.toLowerCase()}/${path.replace(/\/+$/, "")}`;
}

function shorten(s, n = 30) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function dedupSteps(urls) {
  const steps = [];
  const seen = new Set();
  const out = [];
  steps.push({ op: OP.NOTE, text: `归一化 ${urls.length} 个 URL 后去重（保持首次出现顺序）` });
  urls.forEach((u, i) => {
    const key = normalizeUrl(u);
    steps.push({
      op: OP.DECIDE, i, keep: "pending", key,
      note: `归一化：${shorten(u)} → ${shorten(key)}`,
    });
    if (seen.has(key)) {
      steps.push({
        op: OP.DECIDE, i, keep: "drop", key,
        note: `结果集里已有 ${shorten(key)} → 判为重复，丢弃`,
      });
    } else {
      seen.add(key);
      out.push(key);
      steps.push({
        op: OP.DECIDE, i, keep: "keep", key,
        note: `首次出现 → 保留（结果集 ${out.length} 条）`,
      });
      steps.push({
        op: OP.SET_LIST, name: "out", values: [...out],
        note: `写入结果集：${shorten(key)}（当前 ${out.length} 条）`,
      });
    }
    steps.push({ op: OP.SET_METRIC, name: "scanned", value: i + 1 });
  });
  steps.push({
    op: OP.SET_LIST, name: "out", values: [...out],
    note: `去重完成：${urls.length} → ${out.length} 条`,
  });
  return steps;
}

/* ---------------- 目录：构建器、元信息、默认输入 ---------------- */

export const AGENT_BUILDERS = {
  vector: (input) => vectorSearchSteps(input.vectors, input.query, input.k),
  rerank: (input) => rerankSteps(input.routes, input.k),
  ctx: (input) => ctxTrimSteps(input.messages, input.budget),
  router: (input) => routerSteps(input.routes, input.query),
  workflow: (input) => workflowSteps(input.tasks, input.deps),
  dedup: (input) => dedupSteps(input.urls),
};

export function buildAgentSteps(kind, input) {
  const fn = AGENT_BUILDERS[kind];
  if (!fn) throw new Error(`未知场景动画: ${kind}`);
  return fn(input);
}

export const AGENT_INPUTS = {
  vector: {
    vectors: [[1, 0.2], [0.1, 1], [0.9, 0.8], [-0.7, 0.5], [0.4, -0.9], [0.75, 0.72], [0.2, 0.95], [-0.3, -0.6]],
    query: [0.8, 0.85],
    k: 3,
  },
  rerank: {
    routes: [
      [["d1", 0.86], ["d2", 0.72], ["d5", 0.41]],
      [["d2", 0.91], ["d3", 0.63]],
      [["d1", 0.55], ["d4", 0.78], ["d6", 0.30]],
    ],
    k: 4,
  },
  ctx: {
    budget: 120,
    messages: [
      { role: "system", tokens: 18 },
      { role: "user", tokens: 24 },
      { role: "assistant", tokens: 38 },
      { role: "user", tokens: 46 },
      { role: "assistant", tokens: 52 },
    ],
  },
  router: {
    routes: [
      { path: "/tools", handler: "tool-hub" },
      { path: "/tools/search", handler: "web-search" },
      { path: "/tools/search/code", handler: "code-search" },
      { path: "/docs", handler: "doc-reader" },
    ],
    query: "/tools/search/code",
  },
  workflow: {
    // 故意让第一批有两件事可并发（两路取数），这样"分批并行"才看得出来
    tasks: ["fetch-web", "fetch-db", "merge", "embed", "answer"],
    deps: [
      ["fetch-web", "merge"], ["fetch-db", "merge"],
      ["merge", "embed"], ["embed", "answer"], ["fetch-db", "answer"],
    ],
  },
  dedup: {
    urls: [
      "https://Example.com/a/",
      "https://example.com/a",
      "https://docs.Example.com/api?b=2&a=1#top",
      "https://docs.example.com/api?a=1&b=2",
      "http://blog.dev/post/",
      "http://BLOG.dev/post",
    ],
  },
};

export const AGENTS = {
  vector: {
    title: "RAG 向量检索",
    oneLine: "余弦相似度打分 + 容量 k 的小顶堆，库再大堆也只留 k 个",
    time: "O(n·d + n log k)",
    space: "O(k)",
    topic: "ds-heap",
    problem: "p-app-vector-search",
    badge: "RAG",
  },
  rerank: {
    title: "多路召回融合",
    oneLine: "哈希按文档取最高分，再排序取全局 Top-K",
    time: "O(M + m log m)",
    space: "O(m)",
    topic: "ds-hash",
    problem: "p-app-rerank",
    badge: "RAG",
  },
  ctx: {
    title: "上下文窗口裁剪",
    oneLine: "system 必留，其余从最新往回连续装入预算",
    time: "O(n)",
    space: "O(n)",
    topic: "algo-two-pointers",
    problem: "p-app-ctx-window",
    badge: "上下文",
  },
  router: {
    title: "工具路由最长前缀匹配",
    oneLine: "Trie 逐段下行，途中记住最深的注册点",
    time: "O(路径段数)",
    space: "O(规则总段数)",
    topic: "ds-trie",
    problem: "p-app-prefix-router",
    badge: "路由",
  },
  workflow: {
    title: "工作流并行分批",
    oneLine: "Kahn 按层出队，一层就是一批可并发任务",
    time: "O(V + E)",
    space: "O(V + E)",
    topic: "algo-graph",
    problem: "p-app-workflow",
    badge: "编排",
  },
  dedup: {
    title: "检索结果去重",
    oneLine: "先归一化（去锚点、排参数、小写 host）再哈希判重",
    time: "O(N·L)",
    space: "O(N)",
    topic: "ds-hash",
    problem: "p-app-dedup",
    badge: "去重",
  },
};
