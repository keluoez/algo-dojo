---
slug: p-app-workflow
title: Agent 工作流的并行分批编排
difficulty: 2
topics: [algo-graph]
tags: [拓扑排序, Kahn 算法, 工作流, 并行调度]
entry: workflow_batches
starter_code: |
  def workflow_batches(tasks, deps):
      # 返回按批执行的任务列表；批内字典序；存在循环依赖返回 []
      pass
solution_code: |
  def workflow_batches(tasks, deps):
      adj = {t: [] for t in tasks}
      indeg = {t: 0 for t in tasks}
      for a, b in deps:
          adj[a].append(b)
          indeg[b] += 1

      out = []
      batch = sorted(t for t in tasks if indeg[t] == 0)
      done = 0
      while batch:
          out.append(batch)
          done += len(batch)
          nxt = set()
          for t in batch:
              for u in adj[t]:
                  indeg[u] -= 1
                  if indeg[u] == 0:
                      nxt.add(u)
          batch = sorted(nxt)
      return out if done == len(tasks) else []
tests:
  - desc: 菱形依赖分三批
    args:
      - ["a", "b", "c", "d"]
      - [["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"]]
    expected: [["a"], ["b", "c"], ["d"]]
  - desc: 无依赖全部同批
    args:
      - ["b", "a"]
      - []
    expected: [["a", "b"]]
  - desc: 循环依赖
    args:
      - ["a", "b"]
      - [["a", "b"], ["b", "a"]]
    expected: []
  - desc: 链式依赖逐批
    args:
      - ["a", "b", "c"]
      - [["a", "b"], ["b", "c"]]
    expected: [["a"], ["b"], ["c"]]
  - desc: 空任务表
    args:
      - []
      - []
    expected: []
---

Agent 的复杂任务往往拆成一张**工作流 DAG**：搜索→摘要→起草→校对，某些步骤互不依赖就可以**并行**跑（同时调多个工具、并发抓多个页面）。调度器要按"批"执行：

- 第 1 批：所有**无依赖**的任务；
- 第 i 批：依赖都已在更早批次完成的任务；
- 同一批内的任务互相无依赖，可并行执行，**批内按字典序**排列；
- 若存在循环依赖（DAG 不成立），返回空列表 `[]`。

实现 `workflow_batches(tasks, deps)`：`tasks` 是任务名列表（互不相同），`deps` 是 `[前驱, 后继]` 的列表。

**提示**：Kahn 拓扑排序天然是"按层出队"的——一次弹出一整层（而不是一个），每一层就是一批可并行任务。怎么从"出队总数"判断图里有环？

--- 题解 ---

## 思路：Kahn 算法按层出队

建邻接表与入度表。入度为 0 的任务没有未完成的前驱，构成第一批。每执行完一批，把它们的出边全部"删除"（后继入度减一），入度归零的任务进入下一批。如此往返直到没有新批次。

**环检测**：循环自然结束后，统计已分批的任务总数 `done`。若 `done < len(tasks)`，说明有任务入度永远无法归零——它们处在环上（或依赖环的下游），返回 `[]`。

这就是 LangGraph / Dify / n8n 等编排引擎"并行节点调度"的骨架：把同一拓扑层的节点作为一轮并发调用（例如同时发起多个工具调用），层数就是关键路径长度（最长的依赖链），也是工作流的最少执行轮数。

## 复杂度

- 时间 O(V + E + Σ batch·log)：建图线性，每批一次排序（批内字典序）。
- 空间 O(V + E)。

## 易错点

- 一批要**同时**收集完再进入下一批（先整层减入度，再取归零者）——逐个出队会把同层任务错拆成多批。
- 环的判据是"分批总数 < 任务总数"，不是"某次没有新任务"（正常结束的最后一批之后也没有新任务）。
- 批内必须 `sorted`：字典序是判题要求，`set` 直接输出顺序不稳定。
