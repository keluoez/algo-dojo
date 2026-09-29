---
slug: p-lc50
lc: 50
title: Pow(x, n)
difficulty: 2
topics: [algo-tricks, algo-divide]
tags: [快速幂, 位运算, 分治]
entry: my_pow
starter_code: |
  def my_pow(x: float, n: int) -> float:
      pass
solution_code: |
  def my_pow(x: float, n: int) -> float:
      def fast_pow(base, exponent):
          result = 1.0
          while exponent > 0:
              if exponent & 1:
                  result *= base
              base *= base
              exponent >>= 1
          return result

      if n >= 0:
          return fast_pow(x, n)
      return 1.0 / fast_pow(x, -n)
tests:
  - {desc: "正数次幂", args: [2.0, 10], expected: 1024.0}
  - {desc: "负数次幂", args: [2.0, -2], expected: 0.25}
  - {desc: "零次幂", args: [2.1, 0], expected: 1.0}
  - {desc: "奇数次幂", args: [2.0, 7], expected: 128.0}
  - {desc: "分数底", args: [0.5, 3], expected: 0.125}
---

实现 `pow(x, n)`，即计算 x 的整数 n 次幂函数（n 可能为负）。要求 O(log n)，不得连乘 n 次。

**提示**：n 的二进制每一位代表什么？base 不断平方的过程与 n 的二进制位如何配合？

--- 题解 ---

## 思路：快速幂（二进制幂）

把指数拆成二进制：x^13 = x^8 · x^4 · x^1（13 = 1101₂）。

循环中 base 每轮平方（x¹→x²→x⁴→x⁸），指数右移；当前最低位为 1 时把 base 乘进结果。循环 ⌊log n⌋ 轮。

负指数先算正指数再取倒数。这是把"n 次重复"压成"log n 次翻倍"的通用技巧，矩阵快速幂（斐波那契 O(log n)）、模幂（RSA、LC372）都是同一套代码换乘法。

## 与分治递归版对照

`pow(x,n) = pow(x,n/2)²`，n 奇数再乘 x——递归三行写完，思路是分治；迭代版用二进制展开，常数更小、无递归栈。面试时两种都要能默写，并能互相解释。

## 复杂度

- 时间 O(log n)，空间 O(1)。

## 易错点

- 右移与 base 平方的次序：先判最低位、再平方，顺序反了会多乘一次。
- n=-2³¹ 时 -n 在某些语言溢出，Python 任意精度无碍。
- 浮点判题允许微小误差，本平台测试取的都是精确可表示的结果。
