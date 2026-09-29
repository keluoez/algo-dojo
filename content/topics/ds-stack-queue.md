---
slug: ds-stack-queue
category: data-structure
title: 栈与队列
subtitle: LIFO 与 FIFO，以及单调栈、单调队列两大神器
order: 3
difficulty: 2
tags: [栈, 队列, 单调栈, 单调队列, 双端队列]
related_problems: [p-lc232, p-lc155, p-lc739, p-lc84, p-lc239, p-app-editor, p-app-ratelimit]
quizzes:
  - q: 栈和队列分别遵循什么存取规则？
    options: [LIFO 后进先出 / FIFO 先进先出, FIFO / LIFO, 随机存取 / 顺序存取, 按键存取 / 按值存取]
    answer: 0
    explain: 栈像一摞盘子，队列像排队买饭。
  - q: '"每日温度：还要等几天才升温"这类题，单调栈里存的通常是？'
    options:
      - 尚未找到右侧更大元素的下标（值单调递减）
      - 已经处理完的答案
      - 数组的全部前缀和
      - 升序排列的温度值本身
    answer: 0
    explain: 新元素更大时持续弹出栈顶，弹出时正好写出其答案。
  - q: 滑动窗口最大值用什么结构做到每个元素只进出一次？
    options: [单调双端队列, 普通栈, 两个栈, 哈希表]
    answer: 0
    explain: 队头始终是当前窗口最大值下标，新元素淘汰队尾更小者。
  - q: 用两个栈实现队列时，元素什么时候从"入栈"倒到"出栈"？
    options:
      - 出栈为空时，一次性全部倒过去
      - 每入队一个立刻倒
      - 永远不倒
      - 队列满时才倒
    answer: 0
    explain: 空了才倒、且一次倒完，摊还 O(1)。
ops_setup: |
  from collections import deque

operations:
  - name: 入栈（push）
    kind: 增
    desc: O(1)。list 的 append 就是压栈。
    code: |
      def push(stack, x):
          stack.append(x)
          return stack
    demo: |
      stack = []
      push(stack, 1)
      push(stack, 2)
      print(stack)
    output: "[1, 2]"

  - name: 出栈（pop）
    kind: 删
    desc: O(1)。只能从栈顶走，先来的压在底下。
    code: |
      def pop(stack):
          return stack.pop()
    demo: |
      stack = [1, 2, 3]
      print(pop(stack), pop(stack), stack)
    output: "3 2 [1]"

  - name: 看栈顶（peek）
    kind: 查
    desc: O(1)。只看不弹，括号匹配里判断"能不能对上"就靠它。
    code: |
      def peek(stack):
          return stack[-1] if stack else None
    demo: |
      stack = [1, 2, 3]
      print(peek(stack), stack)      # 栈没有被改动
    output: "3 [1, 2, 3]"

  - name: 修改栈顶
    kind: 改
    desc: O(1)，但只能改栈顶——栈不提供按下标访问，改栈底得把整摞弹出来再压回去。
    code: |
      def set_top(stack, value):
          if not stack:
              return None
          stack[-1] = value
          return stack
    demo: |
      print(set_top([1, 2, 3], 30), set_top([], 9))
    output: "[1, 2, 30] None"

  - name: 入队（enqueue）
    kind: 增
    desc: O(1)。deque 的 append，从队尾进。
    code: |
      def enqueue(queue, x):
          queue.append(x)
          return queue
    demo: |
      q = deque()
      enqueue(q, 1)
      enqueue(q, 2)
      print(list(q))
    output: "[1, 2]"

  - name: 出队（dequeue）
    kind: 删
    desc: O(1)。必须用 deque.popleft；list.pop(0) 会把后面元素整体前移，是 O(n)。
    code: |
      def dequeue(queue):
          return queue.popleft()
    demo: |
      q = deque([1, 2, 3])
      print(dequeue(q), dequeue(q), list(q))
    output: "1 2 [3]"

  - name: 双端队列两端进出
    kind: 增
    desc: 两端都是 O(1)。滑动窗口要在队头淘汰过期元素、队尾淘汰更小的元素，全靠它。
    code: |
      def push_front(dq, x):
          dq.appendleft(x)
          return dq


      def push_back(dq, x):
          dq.append(x)
          return dq
    demo: |
      dq = deque([2, 3])
      push_front(dq, 1)
      push_back(dq, 4)
      print(list(dq), dq.popleft(), dq.pop())
    output: "[1, 2, 3, 4] 1 4"

  - name: 单调栈：找下一个更大元素
    kind: 查
    desc: 每个下标只进栈出栈一次，整体 O(n)。栈内存下标、对应值单调递减。
    code: |
      def next_greater(nums):
          ans = [-1] * len(nums)
          stack = []                        # 存下标，对应的值单调递减
          for i, x in enumerate(nums):
              while stack and nums[stack[-1]] < x:
                  ans[stack.pop()] = x      # 被弹出的这一刻，答案就定了
              stack.append(i)
          return ans
    demo: |
      print(next_greater([2, 1, 2, 4, 3]))
    output: "[4, 2, 4, -1, -1]"

  - name: 两个栈实现队列
    kind: 建
    desc: 摊还 O(1)。只在出栈为空时才把入栈整体倒过去，倒一次管很久。
    code: |
      class QueueByStack:
          def __init__(self):
              self.in_stack = []
              self.out_stack = []

          def push(self, x):
              self.in_stack.append(x)

          def pop(self):
              if not self.out_stack:
                  while self.in_stack:      # 空了才倒，且一次倒完
                      self.out_stack.append(self.in_stack.pop())
              return self.out_stack.pop()
    demo: |
      q = QueueByStack()
      q.push(1)
      q.push(2)
      q.push(3)
      print(q.pop(), q.pop())
      q.push(4)
      print(q.pop(), q.pop())
    output: "1 2\n3 4"
---

## 一句话理解

**栈**像一摞盘子（后进先出 LIFO），**队列**像排队（先进先出 FIFO）；**单调栈/单调队列**则是在普通结构上维护"单调性"，用来批量处理"下一个更大元素"和"窗口最值"问题。

## 核心概念

Python 中栈直接用 `list`（`append` / `pop` 都是 O(1)）；队列用 `collections.deque`（头尾操作都 O(1)）。

**单调栈**：栈内元素保持单调。以"每日温度"为例，栈里存下标且对应温度递减；遇到更高温度就弹栈，弹出的瞬间答案确定：

```python
def daily_temperatures(temps):
    answer = [0] * len(temps)
    stack = []                       # 存下标，对应温度递减
    for i, t in enumerate(temps):
        while stack and temps[stack[-1]] < t:
            prev = stack.pop()
            answer[prev] = i - prev # 弹出时才知道答案
        stack.append(i)
    return answer
```

**单调队列**（基于 deque）：队头永远是当前窗口最大值的下标。新元素入队前，把队尾比它小的全部踢掉；窗口滑动时再清理过期队头。

**双端队列 deque**：两端都能 O(1) 进出，是单调队列和 BFS 的底层结构。

**栈实现队列**：入队只管压入"入栈"；出队时若"出栈"为空，把入栈整体倾倒过去，倒一次管很久。

## 现实中的典型案例

- **栈**：浏览器页面"返回"、函数调用栈（递归本质就是调用栈）、编辑器撤销（Ctrl+Z）、括号匹配检查。
- **队列**：消息队列、打印机任务排队、客服坐席分配、秒杀请求削峰。
- **单调栈**：股票"连跌后首次反弹"、直方图最大矩形、编译器嵌套作用域。
- **单调队列**：实时监控"最近 1 分钟最高并发"、K 线滑动窗口最高成交价、网卡滑动窗口。

## 什么时候用

- 需要"对称/嵌套"结构（括号、路径、递归）→ 栈。
- 需要"按到达顺序公平处理"→ 队列（BFS 也靠它）。
- 涉及"**下一个比我大/小的元素**"、"每弹出一个就确定一个答案"→ 单调栈。
- 区间/窗口内求最值且窗口只朝一个方向移动 → 单调队列。

## 易错点

- 单调栈里存**下标**而非值，因为算距离和回写答案都需要位置。
- 弹栈条件的严格不等号（`<` 还是 `<=`）决定相等元素怎么处理，按题意选。
- 单调队列要同时处理两件事：新元素淘汰队尾、队头下标过期。
- 柱状图最大矩形别忘了遍历结束后栈里可能还有元素，需要补一轮弹出。
