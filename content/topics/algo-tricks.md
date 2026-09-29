---
slug: algo-tricks
category: algorithm
title: 高频技巧
subtitle: 前缀和差分、位运算、数学工具——散点知识工具箱
order: 9
difficulty: 2
tags: [位运算, 快速幂, GCD, 前缀和, 数学]
related_problems: [p-lc136, p-lc50, p-lc560, p-lc739]
quizzes:
  - q: '"只出现一次的数字（其余出现两次）"用什么性质一趟找出？'
    options:
      - 异或：x^x=0，x^0=x，且满足交换结合律
      - 与运算
      - 取模
      - 排序
    answer: 0
    explain: 全部异或一遍，成对的归零，剩下的就是答案。
  - q: 快速幂把 x^n 从 O(n) 优化到？
    options: [O(log n), O(1), O(√n), O(n log n)]
    answer: 0
    explain: 按 n 的二进制位，平方底数、累加结果。
  - q: 判断奇偶的位运算写法是？
    options: [n & 1, n | 1, n ^ 1, ~n]
    answer: 0
    explain: 最低位为 1 即奇数，也常配合 n>>1 代替整除 2。
  - q: GCD（最大公约数）经典算法是？
    options:
      - 辗转相除法 gcd(a,b)=gcd(b, a mod b)
      - 快速幂
      - 埃氏筛
      - 二分
    answer: 0
    explain: math.gcd 直接可用；LCM = a//gcd*b。
---

## 一句话理解

这些不属于某一类"大算法"，而是**反复出现的小工具**：前缀和/差分做预处理，位运算利用二进制结构，数学工具（GCD、快速幂、素数筛）把朴素做法压缩一个数量级。

## 核心技巧

**位运算**（Python 整数支持任意长度和负数补码思维）：

```python
# 异或性质：x ^ x = 0，x ^ 0 = x
def single_number(nums):
    result = 0
    for x in nums:
        result ^= x
    return result

# 常见手法
n & 1          # 判断奇偶
n & (n - 1)    # 消除最低位的 1（也可判断 2 的幂：结果为 0 即幂）
n >> 1         # 整除 2
a ^= b; b ^= a; a ^= b   # 不借助临时变量交换（理解即可）
```

**快速幂**：把指数看成二进制。每次底数平方，指数位为 1 时乘进答案：

```python
def my_pow(x, n):
    if n < 0:
        x = 1 / x
        n = -n
    result = 1
    while n:
        if n & 1:
            result *= x
        x *= x
        n >>= 1
    return result
```

**数学工具**：

```python
import math
math.gcd(12, 18)           # 6
# 埃拉托斯特尼筛法：求 n 以内全部素数，O(n log log n)
def primes(n):
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False
    for i in range(2, int(n ** 0.5) + 1):
        if is_prime[i]:
            for j in range(i * i, n + 1, i):
                is_prime[j] = False
    return [i for i in range(2, n + 1) if is_prime[i]]
```

**前缀和 + 哈希**（和为 k 的子数组）：遍历前缀和，查历史前缀等于 `prefix-k` 的出现次数，初始放 `{0:1}`。

## 现实中的典型案例

- **位运算**：权限开关组合（Linux chmod、读/写/执行位）、图形图像处理、单片机寄存器。
- 快速幂：RSA 等密码学的模幂运算、矩阵快速幂求线性递推（大数据量斐波那契）。
- GCD：分数约分、周期事件对齐（两个闹钟什么时候同时响 = LCM）。
- 素数筛：密码学密钥生成、哈希函数选模。
- 前缀和计数：流量监控中"累计请求数达到阈值的时刻"。

## 什么时候用

- 题目出现"成对抵消/只出现一次"、"二进制位" → 异或与位掩码。
- n 很大的幂运算、递推数列 → 快速幂/矩阵快速幂。
- 需要素数表或批量约分 → 筛法 / GCD。
- 技巧题通常代码极短，重点是识别信号；没有信号时不要硬套。

## 易错点

- Python 负数右移和补码行为与 C++ 不同，位运算优先处理正数。
- 快速幂注意 n 为负和 x 为 0/1 的边界。
- `n & (n-1)` 判 2 的幂时先保证 n>0。
- 筛法内层从 `i*i` 开始，别从 2i（不影响正确性但慢）。
