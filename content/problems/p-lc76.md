---
slug: p-lc76
lc: 76
title: 最小覆盖子串
difficulty: 3
topics: [algo-two-pointers]
tags: [滑动窗口, 哈希表]
entry: min_window
starter_code: |
  def min_window(s: str, t: str) -> str:
      # 不存在覆盖子串时返回 ""
      pass
solution_code: |
  from collections import Counter

  def min_window(s: str, t: str) -> str:
      need = Counter(t)
      missing = len(t)
      left = 0
      best_l, best_r = 0, float('inf')

      for right, ch in enumerate(s):
          if need[ch] > 0:
              missing -= 1
          need[ch] -= 1
          if missing == 0:
              while left <= right and need[s[left]] < 0:
                  need[s[left]] += 1
                  left += 1
              if right - left < best_r - best_l:
                  best_l, best_r = left, right
              need[s[left]] += 1
              missing += 1
              left += 1

      return '' if best_r == float('inf') else s[best_l:best_r + 1]
tests:
  - {desc: "经典用例", args: [ADOBECODEBANC, ABC], expected: BANC}
  - {desc: "整串即答案", args: [a, a], expected: a}
  - {desc: "无法覆盖", args: [a, aa], expected: ""}
  - {desc: "重复字符需求 aa", args: [aabcabc, aabc], expected: aabc}
---

给定字符串 `s` 和 `t`，返回 `s` 中涵盖 `t` **所有字符（含重复次数）**的最小子串；不存在则返回 `""`。

**提示**：用一个计数器记录"还缺多少个字符"，窗口满足覆盖后如何收缩左端？

--- 题解 ---

## 思路：need 计数 + missing 缺口

need 表正数表示还缺几个、负数表示窗口内富余几个；missing 是"尚未满足的字符总个数"。

1. 右扩：need[ch] 减 1，若减之前 >0 说明补上了一个缺口，missing 减 1；
2. missing==0 时窗口已覆盖，左端只要 need[s[left]]<0（富余）就不断收缩；
3. 收缩到不能再缩，记录最优窗口，然后主动放走左端点（need+1、missing+1），继续找下一个候选。

## 复杂度

- 时间 O(n)：每个字符最多进出窗口一次。
- 空间 O(k)：k 为字符集大小。

## 易错点

- t 中重复字符必须按次数覆盖，用 set 会错（a/aa）。
- 记录答案后要"放走一个必需字符"才能触发下一轮寻找。
