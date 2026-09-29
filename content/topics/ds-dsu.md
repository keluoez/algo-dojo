---
slug: ds-dsu
category: data-structure
title: 并查集
subtitle: 只管"谁和谁是一伙的"——连通性问题的专用结构
order: 9
difficulty: 2
tags: [并查集, 连通性, 路径压缩]
related_problems: [p-lc547, p-lc721]
quizzes:
  - q: 并查集最擅长回答的问题是？
    options:
      - 两个元素是否属于同一集合、共有几个连通块
      - 两节点间最短路径
      - 元素出现频次
      - 区间最大值
    answer: 0
    explain: 它维护不相交集合的合并与归属查询。
  - q: '"union(x, y)" 操作的含义是？'
    options: [把 x 和 y 所在集合合并为一个, 比较大小, 求公共祖先路径, 删除边]
    answer: 0
    explain: 先 find 根，根不同则挂到一起。
  - q: '"路径压缩"优化的作用是？'
    options:
      - 查询时把沿途节点直接指向根，树越来越扁
      - 让元素按值排序
      - 减少存储元素的数组大小
      - 防止重复合并
    answer: 0
    explain: 配合按秩合并，单次操作近乎常数时间。
  - q: 判断无向图最终连通分量个数，并查集之外也能用？
    options: [BFS/DFS 遍历计数, 二分查找, 单调栈, 前缀和]
    answer: 0
    explain: 静态图 BFS/DFS 可以；并查集更适合边逐条加入的动态过程。
ops_setup: |
  class DSU:
      """一份完整可用的并查集；下面的操作逐个拆开讲它的原理。"""

      def __init__(self, n):
          self.parent = list(range(n))
          self.rank = [0] * n        # 树的高度上界，用来决定谁挂到谁下面
          self.size = [1] * n        # 每个连通块的大小，只在根上有意义

      def find(self, x):
          while self.parent[x] != x:
              self.parent[x] = self.parent[self.parent[x]]   # 路径压缩：顺手挂到爷爷
              x = self.parent[x]
          return x

      def union(self, a, b):
          ra, rb = self.find(a), self.find(b)
          if ra == rb:
              return False           # 本来就是一伙的，返回 False 表示没合并
          if self.rank[ra] < self.rank[rb]:
              ra, rb = rb, ra        # 矮树挂到高树下，树才不会越长越高
          self.parent[rb] = ra
          self.size[ra] += self.size[rb]
          if self.rank[ra] == self.rank[rb]:
              self.rank[ra] += 1
          return True

operations:
  - name: 查找代表（find + 路径压缩）
    kind: 查
    desc: 近乎 O(1)。查询时把沿途节点直接挂到根上，下次再查就是一步到位。
    code: |
      def dsu_find(dsu, x):
          root = x
          while dsu.parent[root] != root:
              root = dsu.parent[root]
          while dsu.parent[x] != root:      # 第二趟：把整条路径压平
              dsu.parent[x], x = root, dsu.parent[x]
          return root
    demo: |
      dsu = DSU(6)
      dsu.parent = [1, 2, 2, 3, 5, 5]      # 0 -> 1 -> 2 这条链
      print(dsu_find(dsu, 0), dsu.parent)  # 查一次之后 0、1 都直挂 2
    output: "2 [2, 2, 2, 3, 5, 5]"

  - name: 合并（union + 按秩）
    kind: 增
    desc: 近乎 O(1)。矮树挂到高树下，树高才不会退化；已连通时返回 False。
    code: |
      def union(dsu, a, b):
          ra, rb = dsu.find(a), dsu.find(b)
          if ra == rb:
              return False
          if dsu.rank[ra] < dsu.rank[rb]:
              ra, rb = rb, ra
          dsu.parent[rb] = ra
          dsu.size[ra] += dsu.size[rb]
          if dsu.rank[ra] == dsu.rank[rb]:
              dsu.rank[ra] += 1
          return True
    demo: |
      dsu = DSU(5)
      print(union(dsu, 0, 1), union(dsu, 1, 2), union(dsu, 0, 2))
      print(dsu.parent, dsu.size)
    output: "True True False\n[0, 0, 0, 3, 4] [3, 1, 1, 1, 1]"

  - name: 判断是否连通
    kind: 查
    desc: 近乎 O(1)。两个节点的代表元相同即同一伙，不需要真的找路径。
    code: |
      def connected(dsu, a, b):
          return dsu.find(a) == dsu.find(b)
    demo: |
      dsu = DSU(4)
      dsu.union(0, 1)
      print(connected(dsu, 0, 1), connected(dsu, 2, 3))
    output: "True False"

  - name: 连通块个数
    kind: 查
    desc: O(n)。数一数有多少个不同的代表元即可。
    code: |
      def count_groups(dsu):
          return len({dsu.find(i) for i in range(len(dsu.parent))})
    demo: |
      dsu = DSU(6)
      for a, b in [(0, 1), (2, 3), (1, 2)]:
          dsu.union(a, b)
      print(count_groups(dsu))          # {0,1,2,3} + {4} + {5}
    output: "3"

  - name: 逐条加边并维护块数
    kind: 增
    desc: O(m)。每成功合并一次块数减一，这是动态连通性问题最快的写法。
    code: |
      def merge_edges(n, edges):
          dsu = DSU(n)
          groups = n
          for a, b in edges:
              if dsu.union(a, b):
                  groups -= 1
          return groups
    demo: |
      print(merge_edges(6, [(0, 1), (2, 3), (1, 2), (4, 5)]))
    output: "2"

  - name: 某个连通块的大小
    kind: 查
    desc: 近乎 O(1)。合并时只在根上累加 size，查询时跟着代表元走。
    code: |
      def group_size(dsu, x):
          return dsu.size[dsu.find(x)]
    demo: |
      dsu = DSU(5)
      dsu.union(0, 1)
      dsu.union(1, 2)
      print(group_size(dsu, 0), group_size(dsu, 3))
    output: "3 1"

  - name: 把节点摘出所在块（重置）
    kind: 删
    desc: 近乎 O(1)。并查集天生不支持删除：被摘节点如果还挂着别的节点，会把它们一起带走。
    code: |
      def reset(dsu, x):
          root = dsu.find(x)
          if root == x:
              return False             # 它自己就是根，摘不动
          dsu.size[root] -= 1          # 只能摘"叶子"，否则子树会跟着走
          dsu.parent[x] = x
          dsu.size[x] = 1
          return True
    demo: |
      dsu = DSU(4)
      dsu.union(0, 1)
      dsu.union(1, 2)
      print(reset(dsu, 2), dsu.parent, dsu.size)   # 2 号摘出来后自己成一个块
    output: "True [0, 0, 2, 3] [2, 1, 1, 1]"

  - name: 合并时维护块内最值
    kind: 改
    desc: 近乎 O(1)。除了 parent，块上挂的附加信息也得跟着合并——带权并查集就是这个套路。
    code: |
      def union_with_best(dsu, a, b, best, values):
          """best[root] 记录这个块里 values 最大的元素下标，合并后要重新取最大。"""
          ra, rb = dsu.find(a), dsu.find(b)
          if ra == rb:
              return best[ra]
          if dsu.rank[ra] < dsu.rank[rb]:
              ra, rb = rb, ra
          dsu.parent[rb] = ra
          dsu.size[ra] += dsu.size[rb]
          if dsu.rank[ra] == dsu.rank[rb]:
              dsu.rank[ra] += 1
          best[ra] = max(best[ra], best[rb], key=lambda i: values[i])
          return best[ra]
    demo: |
      values = [3, 9, 5, 1]
      dsu = DSU(4)
      best = list(range(4))            # 初始每块的最大就是自己
      union_with_best(dsu, 0, 1, best, values)
      union_with_best(dsu, 2, 3, best, values)
      print(best[dsu.find(0)], best[dsu.find(2)])
      union_with_best(dsu, 1, 3, best, values)
      print(best[dsu.find(0)])
    output: "1 2\n1"
---

## 一句话理解

并查集（Disjoint Set Union）维护若干**互不相交的集合**，只回答两件事："这两个元素是不是一伙的"、"把两伙人合并"。每个集合用一棵树表示，树根就是集合代表。

## 核心概念

两个核心操作：

- `find(x)`：找到 x 所属集合的根（代表元）。
- `union(x, y)`：分别 find 根，根不同就把两棵树并成一棵。

```python
class DSU:
    def __init__(self, n):
        self.parent = list(range(n))   # 初始各自成集合
        self.size = [1] * n
        self.components = n            # 连通块数量

    def find(self, x):
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]  # 路径压缩：爷爷变爸爸
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False               # 本来就一伙
        if self.size[ra] < self.size[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra           # 小集合挂到大集合（按秩合并）
        self.size[ra] += self.size[rb]
        self.components -= 1
        return True
```

**两大优化**：

1. **路径压缩**：find 时让节点直接指向根，树被压平。
2. **按秩/按大小合并**：小树挂大树，避免越合越高。

两者配合下，单次操作是**反阿克曼函数级别的近常数时间**（实际可视为 O(1)，不必背数学结论）。

## 现实中的典型案例

- **微信好友关系**：判断两人是否在同一个"朋友群簇"、全网有几个独立关系块。
- 社交网络的"共同群组/圈子"分析、游戏里的战队归属。
- 地图/路网：新修一条路就 union 两端，随时回答两地是否连通（Kruskal 最小生成树也用它）。
- 物理引擎中粒子接触成团、图像处理中的连通区域标记。
- 账号系统：把同一人的多个登录方式（手机、邮箱）并成一个账号。

## 什么时候用

- 元素间关系只有"**连不连通 / 是不是一类**"，且关系逐条加入。
- 需要反复合并集合 + 查询归属。
- 需要在过程中维护连通块数量（初始 n，成功 union 一次减 1）。
- 若还要求路径、方向、距离，用 BFS/DFS/最短路算法。

## 易错点

- union 前先 find：直接改 parent 可能只动了叶子。
- `components` 只在"根不同、真合并"时减 1。
- 元素编号不连续（如城市名）时先做名称 → 编号映射。
- 路径压缩的递归写法在数据量极大时可能触顶，迭代写法更稳。
