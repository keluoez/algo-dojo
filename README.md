# 算法修炼场

把算法练成肌肉记忆的本地学习平台：**概念 → 示例 → 在线答题（Python）→ 错题复盘**。

## 快速开始

```bash
pip install -r requirements.txt   # fastapi / uvicorn / pyyaml
run.bat                           # Windows 一键启动，自动打开 http://127.0.0.1:8767
```

或手动：`python -m uvicorn backend.main:app --host 127.0.0.1 --port 8767`。

## 平台里有什么

- **数据结构 11 个主题**：数组字符串、链表、栈队列（含单调栈/队列）、哈希、二叉树、
  BST、堆、Trie、并查集、图、设计类结构
- **算法 9 个主题**：双指针滑窗、二分（含二分答案）、排序快选、搜索回溯、贪心、
  动态规划、分治、图算法、高频技巧
- **87 个基本操作示例**：每个数据结构页都有该结构的增删改查，每条都能在浏览器里
  现场跑（如链表的头插/按位插入/按值删/按位删/改值/查找/找中点），
  输出由 `check_content` 离线跑一遍比对，示例不会与代码脱节
- **63 道精写编程题**：每题含题面、starter、测试用例、参考解、复杂度与易错点；
  **题解不设门禁**，随时可看
- **浏览器内 Pyodide 判题**：代码不出本机，死循环自动超时终止；函数题与类设计题两种形态
- **性能实测**：多份解法同场对比，ECharts 出曲线（如哈希 0.1ms vs 暴力 321ms）
- **学习看板 + 错题本**：已学标记、概念小测、掌握度自动维护

## 测试

```bash
python -m tests.check_content          # 63 道参考解必须通过全部用例 + 87 个操作示例跑通
python -m tests.check_worker_protocol  # 用 CPython 跑 worker 里的判题/示例模板，校验协议
python -m tests.smoke_test             # 390 项端到端断言（自动用临时 DB）
```

依赖都在 `requirements.txt` 里（含测试用的 httpx）；`python -m tests.smoke_test`
需要它，缺了会直接报 `starlette.testclient requires httpx`。

## 二次开发

新增一道题 / 一个知识点的完整契约与步骤见 [docs/DESIGN.md](docs/DESIGN.md)。
注意：内容只在**启动时**加载，改完 Markdown 需要重启服务。
