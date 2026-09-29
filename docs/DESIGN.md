# 算法修炼场 · 设计文档

> 本地单机的算法学习平台：概念 → 示例 → 答题 → 复盘。
> 技术栈：FastAPI + 原生 sqlite3 + 原生 JS SPA + 浏览器内 Pyodide 判题。

## 1. 架构总览

```
浏览器
├─ SPA（hash 路由）
│   ├─ Views（home/catalog/topic/problem/review）
│   ├─ PyRunner ── Web Worker ── Pyodide（WASM Python，判题/性能实测）
│   └─ CodeMirror / marked / ECharts（全部本地 vendor，无外网依赖）
└─ HTTP API（/api/...）
    ├─ routers/content.py   内容只读
    ├─ routers/progress.py  学习数据读写
    └─ ContentRepository（启动时一次性加载 + Pydantic 校验）
        └─ content/*.md（Markdown + YAML frontmatter，唯一内容事实源）
SQLite（data/app.db）：只存学习产生的数据，不存内容
```

核心分层原则：**内容是 Markdown，学习数据是 SQLite，代码执行只在浏览器**。
后端永远不执行用户代码，因此没有沙箱逃逸面，也没有语言运行时依赖。

## 2. 关键架构决策

| 决策 | 理由 |
|---|---|
| Pyodide 在浏览器判题 | 代码不出本机；无需后端沙箱；断网可用（vendor 内 13MB 核心文件，失败自动一次性回退 CDN） |
| Worker 隔离 Pyodide | WASM 计算阻塞主线程；死循环/超时直接 terminate 并重建 Worker（判题 12s，实测 120s） |
| 内容即代码（md+frontmatter） | 改内容不需迁移数据库；Git diff 可读；启动时 Pydantic fail-fast 校验 |
| 原生 sqlite3 + 四函数 | query/query_one/execute/init_db，不引 ORM——表只有 5 张，抽象成本高于收益 |
| 原生 JS、无构建 | 无 npm/打包链路；h() hyperscript 代替 JSX；全局对象明确（Views/API/Toast/PyRunner） |
| APIRouter 分域 | 相比「秋招军师」单 main.py 的演进，内容与学习数据各一个 router |
| 题面/题解物理分离 | 题目正文与 `--- 题解 ---` 之后的讲解在加载时切开，未通过前看不到题解，防剧透 |

## 3. 内容契约

### 知识点 `content/topics/*.md`

frontmatter：`slug / category(data-structure|algorithm) / title / subtitle / order /
difficulty(1-3) / tags / prerequisites / related_problems / quizzes[]`。

quiz：`q / options(≥2) / answer(下标) / explain`。正文按固定章节写：
一句话理解 → 核心概念 → 现实中的典型案例 → 什么时候用 → Python 示例 → 易错点。

### 题目 `content/problems/*.md`

| 字段 | 说明 |
|---|---|
| slug / lc / title / difficulty / topics / tags | 基本信息；topics 必须是已存在的知识点 slug |
| entry | 入口函数名 |
| starter_code / solution_code | 编辑器初始代码 / 参考解（solution 必须通过全部测试） |
| setup_code | 可选：ListNode/TreeNode 等公共定义 |
| tests[] | `desc / args / args_code / expected / unordered` |
| scenarios[] | 类设计题：`init_args` + steps(`op / args / expected`) |
| result_adapter | 可选：定义 adapt(result)，把链表/树序列化为 JSON |
| bench | 可选：`scales` + generator（generator 须定义 make_input(n)） |

两种判题形态：

- **函数题**：入口函数直接调用。链表/树等 JSON 表达不了的输入用 `args_code`
  （Python 表达式求值为参数 tuple，如 `(build_list([1,2]),)`），
  返回值经 adapt 序列化后比对。
- **类设计题**：用 init_args 构造对象，逐步调用方法（LC146/460/155/208/232）。

注意契约细节：`args_code` 默认空串，Worker 必须用真值判断（`if _c.get("args_code")`），
不能判断键是否存在——model_dump 会把所有字段（含空串）序列化出来。

## 4. API 契约

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/catalog | 2 大类 + 知识点卡片 |
| GET | /api/topics/{slug} | 知识点详情（含 quizzes/正文） |
| GET | /api/problems?topic= | 题目**卡片**列表（slug/lc/title/difficulty/topics/tags/has_bench）；topic 不存在 404 |
| GET | /api/problems/{slug} | 题目详情；未通过全部用例时题解字段为空串且 `solution_unlocked=false`，判题所需的 tests/scenarios/bench 照常下发 |
| GET | /api/problems/{slug} | 题目详情：题面 + 判题数据 + **完整题解**（不设门禁） |
| POST | /api/topics/{slug}/mark | body {learned} |
| POST | /api/topics/{slug}/quiz | body {quiz_index, correct} |
| POST | /api/problems/{slug}/attempts | body {code, passed, total, duration_ms}；自动维护掌握度/错题本 |
| GET | /api/review/wrong | 错题列表 |
| POST | /api/review/{slug}/resolve | 手动移出错题本 |
| GET | /api/progress/overview | 看板汇总 |
| GET | /api/progress/topics · /problems | 明细 |
| POST | /api/bench | 性能实测结果存档 |

错误约定：入参不合法 422（Pydantic）；业务约束 400；资源不存在 404（中文消息）。

**题解不设门禁**：题目详情直接下发 `solution_code` / `solution_md`，随时可看。
（曾经的版本按 `problem_mastery.pass_count > 0` 做过门禁，已移除：本平台是用来查漏补缺的，
把答案锁住只会增加摩擦；想自己先做的话不看题解页即可，不靠服务端藏。）

**知识点的基本操作示例**：数据结构页必须给 `operations`（少于 4 个启动就失败），
每项含 name / kind（增·删·改·查·建·遍历·其它）/ desc / code / demo / output：

- `ops_setup` 放公共定义（结构类与辅助函数），运行时自动前置，不占编辑器；
- 页面把 `ops_setup + code + demo` 拼成整段交给 worker 的 `demo` action，回收 stdout；
- `output` 是期望输出：`tests/check_content` 用真实 Python 逐条跑过并比对，
  改了代码忘了改期望值会立刻失败；`python -m tests.check_content --fix` 可自动回填真实输出。

**Worker 的任务必须串行**：入参是通过 `pyodide.globals` 传给 Python 模板的，
两个请求并发时后一个会覆盖前一个的 `__user_code__` / `__demo_code__`
（表现是"点了三个运行，三个都返回最后一份代码的结果"），
所以 worker 侧用一条 promise 链排队。同理，加载与执行要分开计时：
先发一个 `warmup` 把引擎拉起来，再发真正的任务，
否则排在加载后面的任务会被按纯执行超时误杀。

## 5. 如何新增一道题

1. 新建 `content/problems/p-lcXXX.md`，按第 3 节契约写 frontmatter；
2. 正文写题面，空一行后加 `--- 题解 ---`，再写题解讲解；
3. 至少写 tests 或 scenarios 之一，覆盖：基础示例、边界（空/单元素）、易错构造；
4. 链表/树题加 setup_code、args_code、result_adapter；
5. 想做复杂度对比就加 bench，scales 最大档要保证最慢解法在 120s 内跑完
   （Worker 无单解法超时，整体超时会毁掉全组结果）；
6. 在对应知识点页的 related_problems 里挂上 slug；
7. 跑 `python -m tests.check_content`，再跑 `python -m tests.smoke_test`；
8. **重启服务**——ContentRepository 只在启动时加载一次。

新增知识点同理，注意 category、order 和引用完整性。

## 6. 测试体系

- `tests/check_content.py`：内容硬门槛。用 CPython 复刻 Worker 的判题语义
  （tests + scenarios 两种形态），63 道题的 solution_code 必须全部通过；
  同时校验 quiz 答案下标、bench 生成器可跑。
- `tests/check_worker_protocol.py`：直接抽出 `pyodide-worker.js` 里的 JUDGE_PY /
  BENCH_PY 模板，用 CPython 跑一遍，校验协议（`{rows, ms}`）、args / args_code 的
  真值判断、类设计题路径、用户代码报错与语法错误的降级、bench 的解法隔离。
  **改判题模板必跑**：模板里的 Python 只有浏览器里才会执行，纯后端测试发现不了。
- `tests/smoke_test.py`：TestClient 端到端，299 项断言：目录计数、详情契约、
  列表字段裁剪、题解门禁（未通过 403 / 通过后 63 道题逐一可解锁 / 「我会了」不解锁）、
  标记/小测/判题/错题本/解除完整流转、bench 存档、404/422/400 边界。
  自动使用临时 DB（ALGO_DB_PATH），不污染正式数据。

## 7. 目录结构

```
backend/{main,config,db}.py
backend/content/{models,loader}.py
backend/routers/{content,progress}.py
content/topics/*.md（20）  content/problems/*.md（47）
frontend/index.html  css/style.css
frontend/js/{api,ui,app,pyodide-runner,pyodide-worker}.js + views/*.js
frontend/vendor/{marked,echarts,codemirror,pyodide}
tests/{check_content,check_worker_protocol,smoke_test}.py
```

## 8. 浏览器走查踩坑记录（2026-09-26）

1. **Views 注册表从未初始化**：views/*.js 一执行 `Views.xxx = ...` 就 ReferenceError，
   全站空白。在 ui.js（视图脚本之前）`window.Views = {}`。
2. **args_code 键存在性误判**：空串默认值被 model_dump 序列化，Worker eval("") 报
   SyntaxError，所有函数题全挂。改真值判断。
3. **Worker 无版本号被缓存**：修了 worker 但浏览器一直跑旧版。
   Worker URL 带 `?v=`，index.html 资源版本号一并 bump。
4. **bench 生成器放水**：答案对放在数组首尾，暴力法第一层即命中，测不出 n²。
   答案对改为内部随机位置（实测：n=10000 时暴力 321ms vs 哈希 0.1ms）。
5. **ds↔algo 切换卡住**：跳过重复渲染的签名只含 slug，两个 catalog 页签名都是
   `"catalog:"`，切页被误判为同页而不刷新。签名补 category（params.slug||category）。

## 8.1 代码审查与浏览器实测（2026-09-26 第二轮）

1. **状态栏永远停在"加载中"**：`post()` 每次请求都 `setStatus("loading")`，
   成功回调从不置回 `ready`。改：收到结果即 `engineReady = true; setStatus("ready")`。
2. **冷启动被 12s 超时误杀**：超时从发请求开始计，而引擎加载就在这一次请求内，
   13MB WASM 一慢就报"执行超时（可能存在死循环）"。改：引擎就绪前用
   `ENGINE_LOAD_TIMEOUT`（90s），就绪后按执行时长卡（判题 12s / 实测 120s）；
   teardown 时把 engineReady 清回 false（判超时原因前要先取值，否则永远报"加载超时"）。
3. **判题耗时口径脏**：`performance.now` 包住整个 worker 往返，首次含引擎初始化，
   README 说的"耗时约 Xms"会虚高一个数量级。改：JUDGE_PY 里用 `perf_counter`
   只包用例执行，返回 `{rows, ms}`。
4. **题解根本没锁**：文档写"通过后解锁"，实现是前端隐藏、接口全量下发答案。
   改：服务端门禁 + `/api/problems/{slug}/solution`；列表接口同时裁剪字段。
5. **字段校验器顺序陷阱**：`at_least_one_test` 用 `info.data.get(另一个字段)`，
   字段级校验器按声明顺序执行，校验 tests 时 scenarios 还没进 info.data。
   实测 `tests: []` + 有 scenarios 会误报。改 `@model_validator(mode="after")`。
6. **sqlite3 的 `with conn` 不关连接**：只提交/回滚事务，靠 CPython 引用计数兜底。
   改 contextmanager + 显式 `close()`；`journal_mode=WAL` 挪到 `init_db`（库级属性）。
7. **ECharts 实例与 resize 监听泄漏**：每次进 bench 都 `addEventListener` 且从不
   `dispose`。改：模块级单例监听 + `app:before-unmount` 钩子（app.js 切页时派发）。
8. **依赖漏声明**：`smoke_test` 依赖 httpx（TestClient 用），requirements.txt 里没有，
   干净环境照 README 跑必然失败。已补 httpx 与显式 pydantic。

## 9. 已知遗留问题（待办，非阻塞）

1. `problem_attempts`（含每次提交的代码快照）与 `bench_runs` 只有写入没有读取入口，
   除"今日判题次数"外没有被消费——需要补"提交历史 / 我的最优解 / bench 历史"页面。
2. CodeMirror 5 没有 dispose API，切题后编辑器实例与它注册的 document 级监听会残留；
   现在只清理了 ECharts（`app:before-unmount` 钩子）。
3. `problem_attempts` 未建索引，`bench_runs` 只增不减，长期需要归档策略。
4. `problem.topics` 与 `topic.related_problems` 双向维护冗余，可改单向 + 自动反查。
5. 内容只在启动时加载，改 md 需重启；可加 dev 模式自动 `reset_repository()`。
6. `ALGO_LENIENT_REFS` 语义反直觉（设为 `"0"` 也是宽松开关）。
7. 判题上报的 `passed/total` 完全采信客户端；本地单机可接受，多人使用需服务端复算。

## 10. 算法动画系统（方案已定，待实施）

形态：**一份动画数据，两种渲染**。
- 共享层：每个算法导出纯函数 `buildSteps(input) → Step[]`（确定性，Remotion 逐帧渲染要求）
- 浏览器端：原生 JS + SVG 播放器（单步 / 倍速 / 进度条 / 事件字幕 / 计数器 / 双算法赛跑）
- 视频端：独立 `video/` Node 子工程 import 同一份 step 模块，横屏 1920×1080 出 MP4
- 内容契约：`content/animations/*.md`（沿用 md + frontmatter + 启动校验）

首批（P0）：排序 6 个（冒泡 / 选择 / 插入 / 归并 / 快排 / 堆排）+ 赛跑对比。
后续按 P1（栈队列 / 链表 / 树 / 堆 / 哈希 / 并查集 / 图）、P2（DP / 贪心 / 回溯 / 分治 / Trie）铺开。
完整清单与事件协议见 `docs/REVIEW-and-PLAN.md`。
