---
slug: ds-graph
category: data-structure
title: 图
subtitle: 节点与边构成的关系网络，最通用的离散结构
order: 10
difficulty: 2
tags: [图, 邻接表, BFS, DFS]
related_problems: [p-lc743]
quizzes:
  - q: 表示稀疏图最常用的方式是？
    options: [邻接表（每个节点存自己的邻居列表）, 邻接矩阵, 一维数组, 哈希到字符串]
    answer: 0
    explain: 边数少时邻接表省空间，遍历邻居也直接。
  - q: 邻接矩阵在 n 个节点时的空间复杂度是？
    options: [O(n²), O(n+e), O(n), O(e log n)]
    answer: 0
    explain: 任意两点是否有边一格存储。
  - q: BFS 遍历图时必须额外维护什么？
    options: [已访问集合（防止走回已访问节点）, 全局最大值, 前缀和, 排序数组]
    answer: 0
    explain: 图有环，不标记 visited 会重复入队甚至死循环。
  - q: 无向图中一条边 (u,v) 在邻接表里怎么记录？
    options: [v 加入 u 的邻居、u 加入 v 的邻居（双向各记一次）, 只记一次, 记入矩阵对角线, 不用记录]
    answer: 0
    explain: 无向边天然双向；有向边只记出发方向。
ops_setup: |
  from collections import deque


  def build_graph(n, edges, directed=False):
      """完整可用的建图函数（下面的「建图」操作会拆开讲它的实现）。"""
      adj = [[] for _ in range(n)]
      for u, v in edges:
          adj[u].append(v)
          if not directed:
              adj[v].append(u)
      return adj


  # 演示用的无向图：0-1、0-2、1-3、2-3、3-4
  EDGES = [(0, 1), (0, 2), (1, 3), (2, 3), (3, 4)]

operations:
  - name: 建图（邻接表）
    kind: 建
    desc: O(n+m)。每个节点存自己的邻居列表；无向边要在两端各记一次。
    code: |
      def build_adj(n, edges, directed=False):
          adj = [[] for _ in range(n)]
          for u, v in edges:
              adj[u].append(v)
              if not directed:
                  adj[v].append(u)          # 无向边是双向的
          return adj
    demo: |
      print(build_adj(5, EDGES))
      print(build_adj(5, EDGES, directed=True))
    output: "[[1, 2], [0, 3], [0, 3], [1, 2, 4], [3]]\n[[1, 2], [3], [3], [4], []]"

  - name: 加边
    kind: 增
    desc: O(1)。邻接表加边就是往列表尾部追加，不必像邻接矩阵那样动整行。
    code: |
      def add_edge(adj, u, v, directed=False):
          adj[u].append(v)
          if not directed:
              adj[v].append(u)
          return adj
    demo: |
      adj = build_graph(5, EDGES)
      add_edge(adj, 0, 4)
      print(adj[0], adj[4])
    output: "[1, 2, 4] [3, 0]"

  - name: 删边
    kind: 删
    desc: O(度)。列表删除要线性查找，这是邻接表不如矩阵的少数场景之一。
    code: |
      def remove_edge(adj, u, v, directed=False):
          if v in adj[u]:
              adj[u].remove(v)
          if not directed and u in adj[v]:
              adj[v].remove(u)
          return adj
    demo: |
      adj = build_graph(5, EDGES)
      remove_edge(adj, 0, 1)
      print(adj[0], adj[1])
    output: "[2] [3]"

  - name: 广度优先遍历（BFS）
    kind: 遍历
    desc: O(n+m)。队列按层推进，先访问的一定是离起点更近的节点。
    code: |
      def bfs(adj, start):
          seen, order, queue = {start}, [], deque([start])
          while queue:
              node = queue.popleft()
              order.append(node)
              for nxt in adj[node]:
                  if nxt not in seen:
                      seen.add(nxt)         # 入队时就标记，避免重复入队
                      queue.append(nxt)
          return order
    demo: |
      print(bfs(build_graph(5, EDGES), 0))
    output: "[0, 1, 2, 3, 4]"

  - name: 深度优先遍历（DFS）
    kind: 遍历
    desc: O(n+m)。一条路走到底再回头；递归写法最直观，深图要换成显式栈。
    code: |
      def dfs(adj, start):
          seen, order = set(), []

          def walk(node):
              seen.add(node)
              order.append(node)
              for nxt in adj[node]:
                  if nxt not in seen:
                      walk(nxt)

          walk(start)
          return order
    demo: |
      print(dfs(build_graph(5, EDGES), 0))
    output: "[0, 1, 3, 2, 4]"

  - name: 判断两点是否可达
    kind: 查
    desc: O(n+m)。BFS 途中撞上目标就返回，没必要把整张图走完。
    code: |
      def reachable(adj, start, target):
          seen, queue = {start}, deque([start])
          while queue:
              node = queue.popleft()
              if node == target:
                  return True
              for nxt in adj[node]:
                  if nxt not in seen:
                      seen.add(nxt)
                      queue.append(nxt)
          return False
    demo: |
      print(reachable(build_graph(5, EDGES), 0, 4))
      print(reachable(build_graph(6, EDGES), 0, 5))     # 5 号是孤立点
    output: "True\nFalse"

  - name: 最短跳数（无权图）
    kind: 查
    desc: O(n+m)。BFS 顺带记录层数，第一次到达目标的层数就是最少边数。
    code: |
      def shortest_hops(adj, start, target):
          if start == target:
              return 0
          seen, queue = {start}, deque([(start, 0)])
          while queue:
              node, depth = queue.popleft()
              for nxt in adj[node]:
                  if nxt in seen:
                      continue
                  if nxt == target:
                      return depth + 1
                  seen.add(nxt)
                  queue.append((nxt, depth + 1))
          return -1
    demo: |
      adj = build_graph(5, EDGES)
      print(shortest_hops(adj, 0, 4), shortest_hops(adj, 0, 1))
    output: "3 1"

  - name: 修改边权
    kind: 改
    desc: O(度)。带权图把邻居存成 (邻居, 权重) 元组，改权重就是替换这个位置的元组。
    code: |
      def set_weight(adj, u, v, weight):
          for i, (nxt, _) in enumerate(adj[u]):
              if nxt == v:
                  adj[u][i] = (v, weight)      # 整条记录换掉，权重不可单独赋值
                  if u != v:
                      for j, (back, _) in enumerate(adj[v]):
                          if back == u:
                              adj[v][j] = (u, weight)   # 无向图两端都要改
                  return True
          return False
    demo: |
      adj = [[(1, 5), (2, 3)], [(0, 5)], [(0, 3)]]      # 0-1 权 5，0-2 权 3
      set_weight(adj, 0, 1, 9)
      print(adj)
      print(set_weight(adj, 0, 9, 1))                    # 这条边不存在
    output: "[[(1, 9), (2, 3)], [(0, 9)], [(0, 3)]]\nFalse"
---

## 一句话理解

图 = **节点（顶点）+ 连接节点的边**，用来表达"谁和谁有关系"。树是图的特例（无环连通），图则允许任意多对多关系和环。

## 核心概念

**两种表示法**：

```python
# 邻接表：dict[节点] -> list[(邻居, 权重)]，稀疏图首选
graph = {
    0: [(1, 2), (2, 5)],
    1: [(2, 1)],
    2: [],
}

# 邻接矩阵：matrix[i][j] 存边/权重，稠密图或需要 O(1) 判断两点有无边时
n = 3
matrix = [[float("inf")] * n for _ in range(n)]
for i in range(n):
    matrix[i][i] = 0
matrix[0][1] = 2
```

| 表示 | 空间 | 查邻居 | 判断 (i,j) 有无边 |
|---|---|---|---|
| 邻接表 | O(n+e) | 直接 | O(度数) |
| 邻接矩阵 | O(n²) | O(n) | O(1) |

**两种遍历**：

- **BFS（广度）**：队列，先近后远，配合 visited 集合；适合按"关系层数"扩散（几度人脉、最少边数）。
- **DFS（深度）**：一条路走到黑再回溯，栈或递归；适合可达性、找路、连通分量。

```python
from collections import deque

def bfs(graph, start):
    seen = {start}
    queue = deque([start])
    order = []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v, _ in graph.get(u, []):
            if v not in seen:
                seen.add(v)
                queue.append(v)
    return order
```

图还可分：有向/无向、带权/不带权、稠密/稀疏——表示法和算法跟着这些属性走。

## 现实中的典型案例

- **社交网络**：用户是节点、好友/关注是边；"可能认识的人"就是 BFS 二层人脉。
- 地图导航：路口是节点、道路是带权边（距离/耗时）。
- 互联网网页与超链接（Google 早期 PageRank 就在图上计算）、知识图谱。
- 供应链/工艺路线、航班航线图、神经网络的计算图。
- 依赖关系：npm 包、微服务调用、编译依赖。

## 什么时候用

- 数据是"多对多关系"且关系本身带属性（权重、方向）。
- 问连通、层级扩散、路径、环 → BFS/DFS。
- 关系稀疏 → 邻接表（面试 90% 的默认选择）。
- 关系稠密或高频查询任意两点有无边 → 邻接矩阵。

## 易错点

- 一定带 visited：图有环，不标记会重复访问。
- 无向图邻接表加两次邻居；有向图别加成双向。
- BFS 中"入队时"就标记 visited，不要等出队才标，否则同一节点可能入队多次。
- 节点不是连续整数时用 dict 邻接表，别硬套数组下标。
