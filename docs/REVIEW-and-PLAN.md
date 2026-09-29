# 算法修炼场 · 代码审查与动画系统方案

> 2026-09-26。审查覆盖后端全部模块、前端运行时脚本与内容契约；
> 所有结论都经过实测（CPython 复跑判题模板、TestClient 端到端、真实浏览器走查）。
> 已修问题的技术细节记录在 `DESIGN.md` §8.1，遗留问题在 §9。

## 一、审查结论

### 1.1 已验证的健康面

- `python -m tests.check_content`：63 道题参考解通过全部用例
- `python -m tests.smoke_test`：299 项端到端断言全绿（改造前 293 项）
- `python -m tests.check_worker_protocol`：14 项 worker 判题模板协议断言全绿（新增）
- 浏览器实测：锁定态渲染 → 提交通过 → 题解就地解锁 → 刷新后保持解锁

架构本身没有需要推倒的地方：内容与学习数据分离、代码只在浏览器执行、
启动期 fail-fast 校验，这三条骨架都站得住。

### 1.2 本轮已修（8 项）

| 问题 | 影响 | 修法 |
|---|---|---|
| 状态栏永远停在"加载中" | 跑过判题后状态显示失真 | 收到结果即置 `ready` |
| 冷启动被 12s 超时误杀 | 首次判题必失败且误报"死循环" | 加载/执行两段超时（90s / 12s） |
| 判题耗时口径脏 | 显示值虚高一个数量级 | Python 侧 `perf_counter` 只测用例执行 |
| 题解根本没锁 | F12 或直接请求接口就能看答案 | 服务端门禁 + 独立题解接口 + 列表裁剪 |
| Pydantic 校验器顺序陷阱 | `tests: []` + scenarios 误报（埋雷） | 改 `model_validator(mode="after")` |
| `with conn` 不关连接 | 异常路径滞留句柄 | contextmanager + 显式 close |
| ECharts 实例与监听泄漏 | 反复切题累积实例与回调 | 单例 dispose + 切页卸载钩子 |
| 依赖漏声明 | 干净环境照 README 跑测试必失败 | requirements 补 httpx、显式 pydantic |

### 1.3 遗留（不阻塞，定义在 DESIGN §9）

学习数据只写不读（`problem_attempts` / `bench_runs` 无消费入口）、
CodeMirror 5 无法 dispose、缺索引与归档策略、双向引用冗余、
内容热加载、`ALGO_LENIENT_REFS` 语义、`passed/total` 采信客户端。

## 二、契约变更（向后兼容性说明）

| 接口 | 变更 |
|---|---|
| `GET /api/problems` | 只返回卡片字段；不再包含 `solution_code` / `solution_md` / `tests` / `scenarios` / `bench` / `body_md` |
| `GET /api/problems/{slug}` | 未通过全部用例时 `solution_code`/`solution_md` 为空串，新增 `solution_unlocked`；判题所需的 `entry`/`starter_code`/`tests`/`scenarios`/`setup_code`/`result_adapter`/`bench` 照常下发 |
| `GET /api/problems/{slug}/solution` | 新增。未通过全部用例 → 403 |
| `GET /api/problems?topic=` | topic 不存在时由"静默空数组"改为 404 |
| 前端行为 | 未解锁时 bench 的「参考解法」栏留空并提示；通过后自动填入 |

门禁判据是 `problem_mastery.pass_count > 0`（曾经通过过），
不是 `status='passed'`——否则错题本点一下「我会了」就能解锁答案。

> **后续已撤销**（2026-09-26）：题解门禁整套移除。题目详情直接下发完整题解，
> `/api/problems/{slug}/solution` 接口与 `solution_unlocked` 字段一并删除。
> 理由：本平台是用来查漏补缺的，锁答案只增加摩擦；想先自己做的用户不看题解页即可。

## 三、算法动画系统方案

### 3.1 已确认的决策

| 决策点 | 结论 |
|---|---|
| 交付形态 | 双轨并行：交互播放器 + Remotion 成片 |
| 首批范围 | 排序 6 个（冒泡/选择/插入/归并/快排/堆排）+ 赛跑对比 |
| 视频规格 | 横屏 1920×1080 |
| 施工顺序 | 先修 bug（已完成），再做动画 |

### 3.2 核心结构：一份数据，两种渲染

```
content/animations/*.md          讲解 + 输入预设 + 关联知识点（沿用 md + frontmatter）
        ↓
shared/anim/*.js                 buildSteps(input) → Step[]（确定性，唯一事实源）
        ├─→ frontend 播放器       原生 JS + SVG，可交互
        └─→ video/ (Remotion)     同源 import，逐帧渲染 MP4
                    ↓
        frontend/media/anim/*.mp4
```

必要性：Remotion 是逐帧独立渲染的，只有确定性的 step 数组才能同时驱动
"可回放可拖拽的交互播放器"和"可复现的视频帧"。不这么做，就等于用 React 把
40 个算法重写一遍，且和平台内容彻底脱节。

### 3.3 Step 事件协议（草案）

```js
{ op: "compare", i, j }            // 比较两个位置
{ op: "swap",    i, j }            // 交换
{ op: "set",     i, value }        // 写入（归并/计数排序用）
{ op: "pointer", name: "i", at }   // 命名指针移动（双指针/滑窗/二分）
{ op: "range",   lo, hi }          // 当前考察区间
{ op: "visit",   node }            // 访问结点（树/图）
{ op: "edge",    u, v }            // 遍历边
{ op: "push" | "pop", container, value }  // 栈/队列/哈希桶
{ op: "mark",    target, kind }    // sorted / pivot / active / cleared
{ op: "note",    text }            // 事件字幕，视频里直接烧录
```

### 3.4 七种视图原语

| 原语 | 覆盖 |
|---|---|
| `bars` | 排序、堆、一维 DP |
| `bars+pointers` | 双指针、滑窗、二分、区间收缩 |
| `grid` | DP 表格、N 皇后、网格图 |
| `tree` | 二叉树、BST、堆树形、Trie |
| `graph` | BFS/DFS、拓扑排序、Dijkstra、MST |
| `list` | 链表反转、合并、快慢指针 |
| `containers` | 栈、队列、哈希桶、单调栈/队列 |

### 3.5 动画清单与分级

| 级别 | 内容 | 数量 |
|---|---|---|
| P0 | 冒泡、选择、插入、归并、快排、堆排、计数排序、排序赛跑 | 8 |
| P0 | 二分查找、二分答案、盛水双指针、最长无重复滑窗、快慢指针找环 | 5 |
| P1 | 单调栈、单调队列、柱状图最大矩形、括号匹配、链表反转、四种遍历、BST 查找插入、堆上浮下沉、建堆 O(n)、哈希 vs 暴力、LRU、路径压缩、Trie、BFS/DFS 对比、拓扑排序、Dijkstra | 18 |
| P2 | 0-1 背包填表、LIS、编辑距离、区间调度、跳跃游戏、N 皇后、全排列决策树、归并分治、快速幂 | 9 |

合计约 40 个，全部由 3.4 的 7 个原语组合，不重复写渲染。
MP4 只对 P0 精选出片（单个 15s 1080p 约 1–3MB），其余保持交互播放器形态。

### 3.6 播放器能力

播放 / 暂停 / 单步前进 / 单步回退 / 0.25–8x 变速 / 进度条拖拽 /
事件字幕 / 比较与交换计数器 / 复杂度标注 /
**赛跑模式**（同一输入两个算法并排，按各自事件流推进——冒泡跑到第 3 趟时快排已结束）。

### 3.7 落地位置

- 新增 `content/animations/*.md`，后端 `/api/animations`，启动期 Pydantic 校验
- 新增路由 `#/anim`（动画中心）与 `#/anim/{key}`（大屏播放器）
- 知识点页正文顶部自动内嵌对应动画；算法目录卡片加「动画」徽章
- Remotion 放在独立 `video/` 子工程，仅渲染时使用，平台运行时零 Node 依赖

### 3.8 验收标准

1. 每个动画的 step 序列与 `content/topics/*.md` 里的参考实现语义一致
2. `python -m tests.check_content` / `smoke_test` / `check_worker_protocol` 保持全绿
3. 新增动画内容校验：step 协议合法性 + 排序终态必须有序（可断言）
4. 浏览器实测：播放、单步、倍速、赛跑、进度条拖拽均正常

---

## 四、当前落地状态（与上面方案的偏差，以后面的为准）

### 4.1 与 3.7 的偏差：动画不进后端

方案里写的 `content/animations/*.md` + `/api/animations` **没有实施**，也不打算实施。
动画是纯前端资产：步骤由 `buildSteps(input)` 现场算出来，不含任何需要持久化的内容，
走后端只是多一次网络往返和一个永远为空的表。最终形态：

| 文件 | 职责 |
|---|---|
| `frontend/js/anim/protocol.js` | step 操作码 + 状态归约（`buildStates` 前缀归约，支持 O(1) 拖拽） |
| `frontend/js/anim/sorts.js` | 6 个比较排序的 `buildSteps` |
| `frontend/js/anim/agents.js` | 6 个 Agent 场景的 `buildSteps` |
| `frontend/js/anim/classics.js` | 8 个经典算法的 `buildSteps`（计数排序、二分、双指针、滑窗、贪心、链表） |
| `frontend/js/anim/scenes.js` | 场景总入口：合并上面两类，registry/player/测试只认这一个出口 |
| `frontend/js/anim/render-kit.js` | SVG 绘制原语（舞台 / 面板 / 圆角矩形 / 文字 / 绿浪 / 槽位布局） |
| `frontend/js/anim/render-scene.js` | Agent 场景渲染器 |
| `frontend/js/anim/render-classic.js` | 经典算法渲染器（指针条 / 滑窗 / 答案空间 / 链表） |
| `frontend/js/anim/player.js` | 播放器（浮点进度插值、入场错峰、完成绿浪）+ 柱状图渲染 |
| `frontend/js/anim/audio.js` | WebAudio 音效（默认静音，可开关） |
| `frontend/js/anim/motion.js` | 缓动原语，播放器与未来的 Remotion 共用一份 |

### 4.2 已上线 23 个动画

- **排序 6 个**：冒泡、选择、插入、归并、快排、堆排（柱状图视图）
- **赛跑 3 个**：冒泡 vs 快排、插入 vs 归并、选择 vs 堆排
- **排序（非比较型）1 个**：计数排序
- **指针 / 窗口 / 贪心 5 个**：二分查找、二分答案、盛水双指针、最长无重复子串、跳跃游戏
- **链表 2 个**：链表反转、快慢指针找环
- **Agent 实战场景 6 个**（对应用户的 Agent 应用开发方向，每个都挂了配套题目）

| key | 场景 | 算法 | 配套题目 | 知识点 |
|---|---|---|---|---|
| `agent-vector-search` | RAG 向量检索 | 余弦打分 + 容量 k 小顶堆 | `p-app-vector-search` | ds-heap |
| `agent-rerank` | 多路召回融合 | 哈希取最高分 + 全局排序 | `p-app-rerank` | ds-hash |
| `agent-ctx-window` | 上下文窗口裁剪 | 贪心回溯装预算 | `p-app-ctx-window` | algo-two-pointers |
| `agent-prefix-router` | 工具路由最长前缀 | Trie 逐段下行 | `p-app-prefix-router` | ds-trie |
| `agent-workflow` | 工作流并行分批 | Kahn 分层拓扑 | `p-app-workflow` | algo-graph |
| `agent-dedup` | 检索结果去重 | URL 归一化 + 哈希判重 | `p-app-dedup` | ds-hash |

场景动画沿用了排序动画的全部机制（纯函数步骤、浮点插值、可单步回退），
只是把"数组下标"换成了 `FOCUS / SET_LIST / SET_METRIC / SCORE / DECIDE / LAYER / WALK / TRIE_ADD`
这一类事件——面板、树、图、决策光靠下标说不清。
指针类动画另外用到早就躺在协议里但一直没被用起来的 `RANGE` / `POINTER`。

经典算法这一批的 key 与配套题目：

| key | 动画 | 配套题目 | 知识点 |
|---|---|---|---|
| `classic-counting` | 计数排序 | `p-lc912` | algo-sort |
| `classic-binary-search` | 二分查找 | `p-lc704` | algo-binary-search |
| `classic-binary-answer` | 二分答案（最小可行速度） | `p-lc875` | algo-binary-search |
| `classic-two-water` | 盛水双指针 | —（内容里暂无对应题） | algo-two-pointers |
| `classic-sliding-window` | 最长无重复子串 | `p-lc3` | algo-two-pointers |
| `classic-jump-game` | 跳跃游戏（贪心） | `p-lc55` | algo-greedy |
| `classic-reverse-list` | 链表反转 | `p-lc206` | ds-linked-list |
| `classic-cycle-detect` | 快慢指针找环 | `p-lc142` | ds-linked-list |

### 4.3 四个测试门禁（改动画后必跑）

```
node tests/check_animations.mjs        # 排序：协议合法性、终态有序、确定性、教学结论
node tests/check_agent_animations.mjs  # 场景脚本：14 个场景的答案与暴力解逐一比对（136 项）
node tests/check_player_dom.mjs        # 播放器：入场、插值、绿浪、音效、赛跑（19 项）
node tests/check_scene_dom.mjs         # 场景渲染：入场、单步、字幕、确定性、对比度、重叠、越界（211 项）
```

后两个靠 `tests/dom_stub.mjs` 的最小 DOM stub 在 Node 里跑，不依赖浏览器。
**两份 DOM 测试共用同一个 stub**，避免各写一份导致"渲染坏了测试还绿"。

`check_scene_dom.mjs` 除了功能，还做三类"肉眼在缩略图上看不出来"的几何断言：

1. **对比度**：浅色文字压在亮色块上（亮底必须用 `inkOn()` 换深墨）
2. **重叠**：两个内容块互相盖住（容器底板由渲染器打 `class="scene-chrome"` 排除）
3. **越界与脏值**：元素画到 800×300 画布外，或数值属性是 `NaN`、文本里出现 `undefined`

新增的守卫必须**反向验证**一次（把 bug 改回去看它报不报）。曾经写过一条按底色过滤的
重叠检查，结果把要测的那块也过滤掉了，守卫退化成永真——不改回去试一次根本发现不了。

### 4.4 已知未做

- Remotion `video/` 子工程与 1920×1080 MP4 出片（4.1 的协议已经为逐帧渲染做好准备）
- P1 剩余：单调栈、单调队列、柱状图最大矩形、括号匹配、用栈实现队列、LRU、哈希 vs 暴力、
  路径压缩、BST 查找插入、二叉树四种遍历、堆上浮下沉与建堆 O(n)、BFS/DFS 对比、Dijkstra
- P2 全部：0-1 背包填表、LIS、编辑距离、区间调度、N 皇后、全排列决策树、归并分治、快速幂

P1/P2 剩下的动画需要 3 个还没建的渲染原语：`grid`（DP 表格 / N 皇后）、
`tree`（二叉树 / BST / 堆树形）、`containers`（栈 / 队列 / 哈希桶 / 单调栈）。
建好之后每个动画就只是"一份 buildSteps + 一条目录登记"。
