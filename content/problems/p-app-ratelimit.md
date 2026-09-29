---
slug: p-app-ratelimit
title: 接口限流器（滑动窗口）
difficulty: 2
topics: [ds-design, ds-stack-queue]
tags: [队列, 滑动窗口, 限流]
entry: RateLimiter
starter_code: |
  class RateLimiter:
      def __init__(self, max_calls, window):
          # window 秒内最多允许 max_calls 次调用
          pass

      def allow(self, t):
          # 请求在时刻 t 到达，返回 True（放行）/ False（拒绝）
          pass
solution_code: |
  class RateLimiter:
      def __init__(self, max_calls, window):
          self.max_calls = max_calls
          self.window = window
          self.hits = []      # 队列：窗口内已放行请求的时间戳，递增

      def allow(self, t):
          while self.hits and self.hits[0] <= t - self.window:
              self.hits.pop(0)            # 队头滑出窗口
          if len(self.hits) < self.max_calls:
              self.hits.append(t)         # 记住这一次放行
              return True
          return False
scenarios:
  - init_args: [2, 10]
    steps:
      - {op: allow, args: [1], expected: true}
      - {op: allow, args: [2], expected: true}
      - {op: allow, args: [3], expected: false}
      - {op: allow, args: [5], expected: false}
      - {op: allow, args: [11.5], expected: true}
      - {op: allow, args: [12.5], expected: true}
      - {op: allow, args: [12.9], expected: false}
  - init_args: [3, 60]
    steps:
      - {op: allow, args: [0], expected: true}
      - {op: allow, args: [1], expected: true}
      - {op: allow, args: [2], expected: true}
      - {op: allow, args: [3], expected: false}
      - {op: allow, args: [59], expected: false}
      - {op: allow, args: [60.5], expected: true}
  - init_args: [1, 1]
    steps:
      - {op: allow, args: [0], expected: true}
      - {op: allow, args: [0.5], expected: false}
      - {op: allow, args: [1.0], expected: true}
      - {op: allow, args: [1.01], expected: false}
---

你的接口一秒钟可能被调用上万次，后端扛不住，需要一个**限流器**：在任意长度为 `window` 秒的滑动窗口内，最多放行 `max_calls` 次请求，超出的一律拒绝。

实现 `RateLimiter(max_calls, window)`：

- `allow(t)`：请求在时刻 `t`（秒，浮点数）到达。若它**之前**（严格意义上是 `(t-window, t]` 这段时间内）已放行的请求数不足 `max_calls`，则放行并返回 `True`，否则拒绝返回 `False`。

判定规则细节：时刻 `t0` 放行的请求，在 `t0 + window` 这一时刻起不再占用窗口额度（`<= t - window` 的都算滑出）。

**提示**：放行的时间戳天然按到达顺序递增——这是一个队列，而且只有队头会变旧。

--- 题解 ---

## 思路：时间戳队列

只记录**被放行**的请求时间戳（被拒绝的不占额度，不用记）。因为时间单调递增，这些时间戳在队列里天然有序：

1. `allow(t)` 先把队头所有 `<= t - window` 的时间戳弹出——它们已滑出窗口；
2. 队列剩余长度就是窗口内已放行数，不足 `max_calls` 就放行并 append，否则拒绝。

关键观察是"每个时间戳只会从队头弹出一次"：时间单调递增保证了队头永远是最旧的，不需要遍历整个队列。

## 复杂度

- 每次 `allow` **摊还 O(1)**：每个时间戳一生只进出队列各一次。
- 空间 O(max_calls)：队列长度永远不超过 `max_calls`（放行才入队，超了就拒绝）。

## 易错点

- 滑出条件是 `<= t - window`（含等号）：`t0` 放行的请求在 `t0 + window` 时刻已不再占额度，见场景 3 的 `allow(1.0)` 返回 True。
- 被拒绝的请求**不要**入队——它没占用额度。
- 别用"固定窗口计数"（每分钟重置一次）：那种算法允许窗口边界处瞬间通过 `2 × max_calls` 个请求，是限流器的经典漏洞。
