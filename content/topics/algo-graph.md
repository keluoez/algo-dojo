---
slug: algo-graph
category: algorithm
title: 图算法
subtitle: 拓扑排序判环、Dijkstra 最短路、并查集与最小生成树
order: 8
difficulty: 2
tags: [拓扑排序, Dijkstra, 最短路, 最小生成树]
related_problems: [p-lc207, p-lc210, p-lc547, p-lc743, p-app-robot, p-app-workflow]
quizzes:
  - q: 拓扑排序适用于什么图？得到什么？
    options:
      - 有向无环图 DAG；一个所有边都从前指向后的线性序列
      - 任意图；节点的排序
      - 无向图；最小生成树
      - 稠密图；邻接矩阵
    answer: 0
    explain: 课程表就是典型的先后约束 → DAG。
  - q: Kahn 算法中，什么节点最先入队？
    options: [入度为 0 的节点（没有前置依赖）, 出度为 0, 权值最小, 编号最大]
    answer: 0
    explain: 弹出节点并把其邻居入度 -1，归零再入队。
  - q: 若拓扑排序最终输出节点数少于总数，说明？
    options: [图中存在有向环（依赖矛盾）, 图是连通的, 边太多, 算法出错]
    answer: 0
    explain: 环内节点入度永远降不到 0。
  - q: Dijkstra 算法的核心贪心操作是？
    options:
      - 每轮从未确定节点中选当前距离最小的，松弛其出边
      - 按节点编号顺序处理
      - 先处理边权最大的
      - 随机选点
    answer: 0
    explain: 堆优化 O(e log n)；不能处理负权边。
---

## 一句话理解

图算法处理节点关系上的**顺序、连通和距离**问题：拓扑排序回答"先后约束能不能排出顺序"，Dijkstra 回答"到每个点的最小代价"，并查集回答"连通性"，最小生成树回答"用最少代价把所有点连起来"。

## 核心思想与模板

**拓扑排序（Kahn 算法）**：

1. 统计每个节点的**入度**，入度 0 入队（没有任何前置）；
2. 弹出一个节点放进序列，遍历其出边：邻居入度 -1，归零入队；
3. 序列长度 < 节点数 → 存在环。

```python
from collections import deque

def can_finish(n, prerequisites):
    graph = [[] for _ in range(n)]
    indeg = [0] * n
    for course, pre in prerequisites:
        graph[pre].append(course)
        indeg[course] += 1

    queue = deque(i for i in range(n) if indeg[i] == 0)
    done = 0
    while queue:
        u = queue.popleft()
        done += 1
        for v in graph[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                queue.append(v)
    return done == n
```

DFS 版拓扑判环：用"访问中/已完成"三色标记，遇到访问中的节点即环；后序位置逆序也能得到拓扑序列。

**Dijkstra 单源最短路**：维护起点到各点的当前最短距离，用**小顶堆**反复取距离最小且未确定的节点，对它的每条边做**松弛**——经它中转更近就更新并入堆：

```python
import heapq

def dijkstra(n, graph, start):
    dist = [float("inf")] * n
    dist[start] = 0
    heap = [(0, start)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:                  # 过期的堆记录
            continue
        for v, w in graph[u]:
            nd = d + w
            if nd < dist[v]:             # 松弛
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    return dist
```

O(e log n)。**前提：边权非负**；有负权要用 Bellman-Ford/SPFA。

**最小生成树（了解）**：

- Kruskal：边按权排序，逐条尝试，用**并查集**判断两端不连通才加入。
- Prim：从一个点出发，每次把连接"已选集合—外部"的最短边加入。

## 现实中的典型案例

- **拓扑排序**：课程先修关系、工程编译依赖（make）、任务调度 DAG、npm 包安装顺序、数据管道节点执行顺序（与你在荣耀做的定时采集管道直接对应）。
- **Dijkstra**：地图导航最短路线、网络路由 OSPF 协议、工厂 AGV 路径、供应链最低物流成本。
- **并查集/生成树**：通信基站组网最低成本、村村通修路、集群节点网络规划。

## 什么时候用

- 约束是"必须先有 A 才能 B"，问可行性/顺序 → 拓扑排序。
- 非负带权图求单源最短距离 → Dijkstra；边等权求最少跳数 → BFS 即可。
- 要把若干点连起来且总造价最低 → Kruskal/Prim。
- 只问连通不问顺序和距离 → 并查集。

## 易错点

- 建图方向：先修课 → 课程的边别建反，入度随之算错。
- Dijkstra 堆中存在旧记录，用 `d > dist[u]` 跳过。
- Dijkstra 遇负权边会给错答案，这不是实现 bug 是算法前提。
- 无向图最短路要加双向边，权重相同。
- 拓扑环检测用"输出计数"最省心，不必额外写 visited 数组。
