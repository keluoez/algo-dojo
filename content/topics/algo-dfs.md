---
slug: algo-dfs
category: algorithm
title: 搜索与回溯
subtitle: DFS/BFS 模板，排列组合子集、岛屿问题与剪枝
order: 4
difficulty: 2
tags: [DFS, BFS, 回溯, 剪枝, 排列组合]
related_problems: [p-lc46, p-lc39, p-lc200, p-lc127]
quizzes:
  - q: 回溯法的本质可以理解为？
    options:
      - 试一个选择，递归下去，回来后撤销选择再试下一个（DFS + 状态恢复）
      - 每次贪心选当前最优
      - 从终点倒着 DP
      - 随机枚举
    answer: 0
    explain: 经典三段式：做选择 → 递归 → 撤销选择。
  - q: 写排列/组合的回溯时，为什么需要 used 数组或 start 参数？
    options:
      - 防止重复选取，并区分"顺序有关(排列)"还是"顺序无关(组合)"
      - 节省内存
      - 自动排序
      - 统计答案个数
    answer: 0
    explain: 排列用 used，组合用起点递增。
  - q: 岛屿数量问题的典型做法是？
    options:
      - 遇到 '1' 就计数并用 DFS/BFS 淹没整座岛
      - 求最短路
      - 二分岛屿大小
      - 排序后扫描
    answer: 0
    explain: 访问过的陆地改成 '0'，等价于 visited。
  - q: '"剪枝"的作用是？'
    options:
      - 提前判断某条递归分支不可能得到解/更优解，直接不进入
      - 把树变平衡
      - 减少代码行数
      - 保证排序稳定
    answer: 0
    explain: 如排序后遇到和已超目标就 break 整个循环。
---

## 一句话理解

搜索与回溯的**算法思想**：解空间是一棵树，题目没有数学捷径时就**系统性枚举所有候选**；DFS 一条路走到底，走不通就退回上一层换分支。"剪枝"则是用约束提前砍掉注定无解的子树。

## 核心思想与模板

回溯三段式——**做选择、递归、撤销选择**：

```python
def permute(nums):
    result = []
    path = []
    used = [False] * len(nums)

    def backtrack():
        if len(path) == len(nums):
            result.append(path[:])       # 注意拷贝
            return
        for i in range(len(nums)):
            if used[i]:
                continue
            used[i] = True
            path.append(nums[i])         # 做选择
            backtrack()
            path.pop()                   # 撤销选择
            used[i] = False

    backtrack()
    return result
```

三类经典枚举：

- **排列**：顺序有关，用 used 标记，每层从全体里选没用过的。
- **组合/子集**：顺序无关，递归带 `start`，只往后选，避免 {1,2}/{2,1} 重复。
- **组合总和**：元素可复用则递归仍传当前 i；剪枝前先排序，前缀和已超目标就 break。

**岛屿问题**：网格上的 DFS，越界或遇到水就返回；访问过的陆地改成水，省掉 visited 数组。

**BFS 最短步数**：如单词接龙，每轮队列推进一层、距离 +1，首次到达终点即最短（每条边代价相同）。

## 现实中的典型案例

- **路径规划/迷宫**：扫地机器人走不通就回退；文件搜索递归遍历。
- 排班、排课、N 皇后等约束满足问题：枚举 + 剪枝。
- 编译器正则匹配、游戏 AI 推演后续局面（博弈树也是回溯）。
- 社交关系里"最少经过几个人引荐" → BFS 层数。

## 什么时候用

- 需要列出**所有**可行方案/排列/组合/子集。
- 判断可达、求最少步数（边等权）→ BFS。
- 连通块计数与标记 → DFS/BFS 淹没。
- 能找到数学/贪心结论时优先结论；搜索是保底的通用解法，但要主动找剪枝点。

## 易错点

- 收集答案时忘记拷贝（`path[:]`），最终结果会随回溯全变空。
- 撤销选择要和做选择严格对称，含循环内多处 continue 时检查状态是否残留。
- BFS 入队即标记 visited，避免同一节点重复入队。
- 网格 DFS 四个方向递归前先判行列越界。
- 剪枝条件写错会漏解——只剪"确定无解"的分支。
