---
slug: p-lc72
lc: 72
title: 编辑距离
difficulty: 3
topics: [algo-dp]
tags: [二维DP, 字符串对齐]
entry: min_distance
starter_code: |
  def min_distance(word1: str, word2: str) -> int:
      pass
solution_code: |
  def min_distance(word1: str, word2: str) -> int:
      m, n = len(word1), len(word2)
      dp = [[0] * (n + 1) for _ in range(m + 1)]
      for i in range(m + 1):
          dp[i][0] = i
      for j in range(n + 1):
          dp[0][j] = j
      for i in range(1, m + 1):
          for j in range(1, n + 1):
              if word1[i - 1] == word2[j - 1]:
                  dp[i][j] = dp[i - 1][j - 1]
              else:
                  dp[i][j] = 1 + min(
                      dp[i - 1][j],      # 删除 word1 末位
                      dp[i][j - 1],      # 插入 word2 末位
                      dp[i - 1][j - 1],  # 替换
                  )
      return dp[m][n]
tests:
  - {desc: "经典用例", args: [horse, ros], expected: 3}
  - {desc: "三步插入", args: [intention, execution], expected: 5}
  - {desc: "完全相同", args: [abc, abc], expected: 0}
  - {desc: "一空一非空", args: ["", abc], expected: 3}
  - {desc: "一次替换", args: [abc, abd], expected: 1}
---

给你两个单词 `word1` 和 `word2`，请返回将 word1 转换成 word2 所使用的**最少操作数**。你可以对一个单词进行三种操作：插入一个字符、删除一个字符、替换一个字符。

**提示**：dp[i][j] 仍是"两个前缀"；末位字符相等时代价为 0；不等时三种操作分别对应表格的哪个格子？

--- 题解 ---

## 思路：二维 DP，三种操作对应三个前驱

dp[i][j] = word1 前 i 字符转成 word2 前 j 字符的最少操作：

- 末位相等：无需操作，`dp[i][j] = dp[i-1][j-1]`；
- 末位不等，三种操作各对应一个格子，取最小再加 1：
  - 删除 word1[i-1] → dp[i-1][j]；
  - 插入 word2[j-1] → dp[i][j-1]；
  - 替换末位 → dp[i-1][j-1]。

base case：一个前缀为空时，只能逐个插入/删除，距离等于另一串长度，所以首行首列直接填下标。

## 与 LCS 的对照

两者共享"两个前缀 + 末位是否配对"的骨架：LCS 不相等时只能跳过（取上/左 max）；编辑距离多了"花 1 代价替换/增删"的选择。理解了这层同构，两个方程都不用死记。

## 复杂度

- 时间 O(m·n)，空间 O(m·n)，可滚动压缩到 O(n)。

## 应用场景

编辑距离是模糊匹配的经典度量：拼写纠错、DNA 序列比对、命令行相似度（git 纠错建议）背后都是它或它的变体。

## 易错点

- 相等时不要加 1。
- base case 首行首列容易漏初始化，只靠转移会把它们当 0。
