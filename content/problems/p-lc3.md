---
slug: p-lc3
lc: 3
title: 无重复字符的最长子串
difficulty: 2
topics: [algo-two-pointers]
tags: [滑动窗口, 哈希表]
entry: length_of_longest_substring
starter_code: |
  def length_of_longest_substring(s: str) -> int:
      pass
solution_code: |
  def length_of_longest_substring(s: str) -> int:
      last = {}
      left = 0
      best = 0
      for right, ch in enumerate(s):
          if ch in last and last[ch] >= left:
              left = last[ch] + 1
          last[ch] = right
          best = max(best, right - left + 1)
      return best
tests:
  - {desc: "基础用例 abcabcbb", args: [abcabcbb], expected: 3}
  - {desc: "全重复 bbbbb", args: [bbbbb], expected: 1}
  - {desc: "pwwkew", args: [pwwkew], expected: 3}
  - {desc: "空串", args: [""], expected: 0}
  - {desc: "无重复", args: [abcdef], expected: 6}
bench:
  scales: [1000, 10000, 100000, 300000]
  generator: |
    import random, string
    def make_input(n):
        chars = string.ascii_lowercase
        s = ''.join(random.choice(chars) for _ in range(n))
        return (s,)
---

给定一个字符串 `s`，请你找出其中**不包含重复字符**的最长子串（连续）的长度。

**示例**：`"abcabcbb"` → 3（"abc"）；`"pwwkew"` → 3（"wke"）。

**提示**：右指针每走一步发现窗口内已有该字符时，左指针应该移动到哪里？

--- 题解 ---

## 思路：滑动窗口 + 最近位置表

维护窗口 `[left, right]` 恒无重复。`last[ch]` 记录字符最近一次出现的下标：

- right 处字符若在窗口内出现过（`last[ch] >= left`），把 left 跳到 `last[ch] + 1`；
- 更新 last[ch]，用窗口长度更新答案。

关键在 `>= left` 这个条件：last 里可能记着窗口外的旧位置（如 "abba" 中第二个 a），旧位置不能让 left 回退。

## 复杂度

- 时间 O(n)：左右指针各走一遍。
- 空间 O(k)：k 为字符集大小。

## 易错点

- 用 set 做窗口遇到重复就逐个删字符也是 O(n)，但写 last 跳转更简洁。
- left 只增不减，忘记判断旧位置会导致 "abba" 这类用例出错。
