---
slug: p-app-robot
title: 仓库机器人的最短路线
difficulty: 2
topics: [algo-graph]
tags: [BFS, 网格最短路]
entry: min_steps
starter_code: |
  def min_steps(grid):
      # grid: 字符串列表，S 起点、E 终点、# 障碍、. 空地；返回最少步数，不可达为 -1
      pass
solution_code: |
  from collections import deque

  def min_steps(grid):
      rows, cols = len(grid), len(grid[0])
      start = end = None
      for r in range(rows):
          for c in range(cols):
              if grid[r][c] == "S":
                  start = (r, c)
              elif grid[r][c] == "E":
                  end = (r, c)
      if start is None or end is None:
          return -1

      dist = {start: 0}
      q = deque([start])
      while q:
          r, c = q.popleft()
          if (r, c) == end:
              return dist[(r, c)]
          for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
              nr, nc = r + dr, c + dc
              if (0 <= nr < rows and 0 <= nc < cols
                      and (nr, nc) not in dist and grid[nr][nc] != "#"):
                  dist[(nr, nc)] = dist[(r, c)] + 1
                  q.append((nr, nc))
      return -1
tests:
  - desc: 绕开障碍
    args: [["S..", ".#.", "..E"]]
    expected: 4
  - desc: 一条直线
    args: [["S.E"]]
    expected: 2
  - desc: 被堵死
    args: [["S#E"]]
    expected: -1
  - desc: 绕行下边
    args: [["S.", "#E"]]
    expected: 2
  - desc: 起终点被障碍围死
    args: [["S.#", ".#.", "#.E"]]
    expected: -1
bench:
  scales: [10, 50, 100, 200]
  generator: |
    import random
    def make_input(n):
        n = max(3, n)
        g = [["."] * n for _ in range(n)]
        for _ in range(n * n // 5):          # 两成格子随机放障碍
            g[random.randrange(n)][random.randrange(n)] = "#"
        # 起终点可达性未知也无妨：答案 -1 也合法，跑满 BFS 即可
        g[0][0], g[n - 1][n - 1] = "S", "E"
        return (["".join(row) for row in g],)
---

仓库里有一台拣货机器人。仓库平面图用字符网格表示：`.` 是空地、`#` 是货架（障碍）、`S` 是机器人充电桩（起点）、`E` 是目标货架（终点）。机器人每一步可以上下左右移动一格，不能进障碍、不能出界。

求从 `S` 走到 `E` 的**最少步数**；无法到达返回 `-1`。

**提示**：每一步代价相同（都是 1）——这个条件下，BFS 第一次到达某格的距离就是最短距离。为什么 DFS 不行？为什么 Dijkstra 也没必要？

--- 题解 ---

## 思路：无权图最短路 = BFS

把每个格子看作节点、四邻接看作边，这是一个**边权全为 1** 的图。BFS 按距离分层扩散：第 k 层的格子，最短距离恰好是 k。因此：

- 从 `S` 起 BFS，用 `dist` 字典记录首次到达每个格子的步数；
- 第一次弹出 `E` 时的距离即答案；队列耗尽仍未碰到 `E`，返回 -1。

**为什么不用 DFS**：DFS 一条路走到黑，第一次到达某格的距离可能远大于最短距离。**为什么不用 Dijkstra**：Dijkstra 的优势在边权不等时选"当前最便宜的边"；全 1 边权下 BFS 的出队顺序天然就是按距离排序的，优先队列是多余的。

## 复杂度

- 时间 O(R×C)：每个格子最多入队一次、出队一次。
- 空间 O(R×C)：`dist` 与队列。
- 顺带一提：如果允许斜着走（八方向且斜行也算 1 步），层内距离不再一致，就要换成 Dijkstra 或双向 BFS。

## 易错点

- 判重必须在**入队时**做（`not in dist` 才入队），出队时才判会重复入队，队列爆炸。
- 障碍格 `#` 不能入队，但 `S`、`E` 本身是可走的格子。
- 返回前记得处理 `E` 根本不可达的分支（队列耗尽）。
