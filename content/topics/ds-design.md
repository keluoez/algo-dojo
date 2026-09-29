---
slug: ds-design
category: data-structure
title: 设计类结构
subtitle: LRU/LFU、最小栈——把多个结构组合成满足接口的组件
order: 11
difficulty: 3
tags: [设计题, LRU, LFU, 组合数据结构]
related_problems: [p-lc146, p-lc460, p-app-ratelimit]
quizzes:
  - q: LRU 缓存满了要淘汰谁？
    options: [最久没被访问的元素, 最早被写入且永不更新, 值最小的, key 最长的]
    answer: 0
    explain: 每次访问都刷新其"最近使用"时间。
  - q: 手写 LRU 要求 get/put 都 O(1)，标准组合是？
    options:
      - 哈希表 + 双向链表
      - 两个数组
      - 一个栈
      - 二叉搜索树 + 队列
    answer: 0
    explain: 哈希定位节点，双向链表 O(1) 维护新旧顺序。
  - q: LFU 与 LRU 的关键区别是？
    options:
      - LFU 先淘汰访问频次最低的，频次相同再看最久未用
      - LFU 完全随机淘汰
      - LFU 只按写入时间
      - 两者完全等价
    answer: 0
    explain: 维护频次计数，需要频次 → 同频节点链表 的映射。
  - q: '"最小栈 minStack"要在 O(1) 返回最小值，常见做法是？'
    options:
      - 辅助栈同步记录每个时刻的最小值
      - 每次全部排序
      - 用一个变量但弹出时无需处理
      - 堆且不删除
    answer: 0
    explain: 数据栈与最小栈同进同出（或只在更小时压栈）。
ops_setup: |
  from collections import OrderedDict


  class LRUCache:
      """一份完整可用的 LRU 缓存；下面三个操作拆开讲它的写入、读取与淘汰。"""

      def __init__(self, capacity):
          self.capacity = capacity
          self.data = OrderedDict()

      def get(self, key):
          if key not in self.data:
              return -1
          self.data.move_to_end(key)          # 读过就算"刚用过"
          return self.data[key]

      def put(self, key, value):
          if key in self.data:
              self.data.move_to_end(key)
          self.data[key] = value
          if len(self.data) > self.capacity:
              self.data.popitem(last=False)   # 队头就是最久未用

operations:
  - name: 最小栈（O(1) 取最小值）
    kind: 建
    desc: 每个操作都 O(1)。额外一个"最小栈"同步记录当前最小值，主栈弹出去的正好是它才跟着弹。
    code: |
      class MinStack:
          def __init__(self):
              self.data = []
              self.min_stack = []           # 栈顶永远是当前最小值

          def push(self, x):
              self.data.append(x)
              if not self.min_stack or x <= self.min_stack[-1]:
                  self.min_stack.append(x)

          def pop(self):
              x = self.data.pop()
              if x == self.min_stack[-1]:
                  self.min_stack.pop()      # 最小值被弹走了才同步
              return x

          def get_min(self):
              return self.min_stack[-1]
    demo: |
      stack = MinStack()
      for x in [3, 1, 2, 0]:
          stack.push(x)
      print(stack.get_min(), stack.pop(), stack.get_min())
    output: "0 0 1"

  - name: 两个栈实现队列
    kind: 建
    desc: 摊还 O(1)。入队只压入栈，出栈空了才整体倒一次——倒一次能顶很多次出队。
    code: |
      class QueueByTwoStacks:
          def __init__(self):
              self.in_stack = []
              self.out_stack = []

          def push(self, x):
              self.in_stack.append(x)

          def pop(self):
              if not self.out_stack:
                  while self.in_stack:
                      self.out_stack.append(self.in_stack.pop())
              return self.out_stack.pop()
    demo: |
      q = QueueByTwoStacks()
      q.push(1)
      q.push(2)
      q.push(3)
      print(q.pop(), q.pop())
      q.push(4)
      print(q.pop(), q.pop())
    output: "1 2\n3 4"

  - name: LRU 写入
    kind: 增
    desc: O(1)。OrderedDict 记住插入顺序，写完提到队尾；超出容量就淘汰队头。
    code: |
      def lru_put(cache, key, value):
          if key in cache.data:
              cache.data.move_to_end(key)     # 已存在：先挪到"最近"
          cache.data[key] = value
          if len(cache.data) > cache.capacity:
              cache.data.popitem(last=False)
          return cache
    demo: |
      cache = LRUCache(2)
      lru_put(cache, "a", 1)
      lru_put(cache, "b", 2)
      print(list(cache.data.items()))
      lru_put(cache, "a", 10)                 # 更新已有 key，a 变成最近使用
      print(list(cache.data.items()))
    output: "[('a', 1), ('b', 2)]\n[('b', 2), ('a', 10)]"

  - name: LRU 读取
    kind: 查
    desc: O(1)。读也是"用过"，必须把它挪到队尾，否则淘汰顺序就错了。
    code: |
      def lru_get(cache, key):
          if key not in cache.data:
              return -1
          cache.data.move_to_end(key)         # 读一次就刷新使用时间
          return cache.data[key]
    demo: |
      cache = LRUCache(2)
      cache.put("a", 1)
      cache.put("b", 2)
      print(lru_get(cache, "a"), list(cache.data.items()))
      print(lru_get(cache, "z"))
    output: "1 [('b', 2), ('a', 1)]\n-1"

  - name: LRU 淘汰最久未用
    kind: 删
    desc: O(1)。队头就是最久没被读写的那个；popitem(last=False) 一次搞定。
    code: |
      def evict(cache):
          if not cache.data:
              return None
          return cache.data.popitem(last=False)
    demo: |
      cache = LRUCache(2)
      cache.put("a", 1)
      cache.put("b", 2)
      cache.get("a")                # a 被读取，变成最近使用
      cache.put("c", 3)             # 超容量，被淘汰的是 b 而不是 a
      print(list(cache.data.items()))
      print(evict(cache), list(cache.data.items()))
    output: "[('a', 1), ('c', 3)]\n('a', 1) [('c', 3)]"

  - name: 滑动窗口限流
    kind: 建
    desc: 均摊 O(1)。队列里只留窗口内的请求时间戳，长度到上限就拒绝。
    code: |
      from collections import deque


      class SlidingWindowLimiter:
          def __init__(self, limit, window_ms):
              self.limit = limit
              self.window_ms = window_ms
              self.hits = deque()             # 窗口内的请求时间戳

          def allow(self, now_ms):
              while self.hits and now_ms - self.hits[0] >= self.window_ms:
                  self.hits.popleft()         # 划出窗口的旧请求先清掉
              if len(self.hits) < self.limit:
                  self.hits.append(now_ms)
                  return True
              return False
    demo: |
      limiter = SlidingWindowLimiter(3, 1000)
      print([limiter.allow(t) for t in [0, 100, 200, 300, 1200]])
    output: "[True, True, True, False, True]"

  - name: LRU 更新已有 key
    kind: 改
    desc: O(1)。更新值之外必须再 move_to_end 一次，否则这条数据会被误判成"最久未用"。
    code: |
      def update(cache, key, value):
          if key not in cache.data:
              return False
          cache.data[key] = value
          cache.data.move_to_end(key)      # 写过也算"刚用过"
          return True
    demo: |
      cache = LRUCache(2)
      cache.put("a", 1)
      print(update(cache, "a", 100), list(cache.data.items()))
      print(update(cache, "z", 1))         # 没有这个 key，改不动
    output: "True [('a', 100)]\nFalse"
---

## 一句话理解

设计题不考新算法，考的是**把已学结构组合起来、实现一套接口且每个操作满足复杂度**。LRU/LFU 是最高频的代表，核心是"哈希表负责找、链表负责顺序"。

## 核心概念

**LRU（最近最少使用）**：

- 行为：get 读一次、put 写/更新一次都算"用过"；容量满时淘汰最久没用的。
- 结构：哈希表 `key → 链表节点` 实现 O(1) 定位；双向链表头部最新、尾部最旧，O(1) 摘除和插入。
- 套路：抽出三个私有操作——删除节点、节点插到头部、淘汰尾部，get/put 只组合这三步。

```python
class Node:
    def __init__(self, key=0, val=0):
        self.key = key
        self.val = val
        self.prev = self.next = None

class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.map = {}
        self.head, self.tail = Node(), Node()
        self.head.next = self.tail
        self.tail.prev = self.head

    def get(self, key):
        if key not in self.map:
            return -1
        node = self.map[key]
        self._move_to_head(node)
        return node.val

    def put(self, key, value):
        if key in self.map:
            node = self.map[key]
            node.val = value
            self._move_to_head(node)
        else:
            node = Node(key, value)
            self.map[key] = node
            self._add_head(node)
            if len(self.map) > self.cap:
                old = self.tail.prev
                self._remove(old)
                del self.map[old.key]

    # 组合用的私有操作
    def _add_head(self, node):
        node.next = self.head.next
        node.prev = self.head
        self.head.next.prev = node
        self.head.next = node

    def _remove(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def _move_to_head(self, node):
        self._remove(node)
        self._add_head(node)
```

**LFU（最不经常使用）**：

- 先按**访问频次**淘汰；同频次内再淘汰最久没用的。
- 结构：两张哈希表——`key → (值, 频次, 节点)` 与 `频次 → 双向链表`；维护当前最小频次。理解结构即可，它是设计题里最难的一档。

**最小栈**：数据栈正常压弹，另开一个最小栈记录"截至此刻"的最小值，栈顶即答案，两栈同步。

**迭代器模式**：把"如何遍历一个结构"封装成统一的 `has_next() / next()`，调用方不依赖内部表示。

## 现实中的典型案例

- **CPU 缓存 / Redis 的 maxmemory-policy**：就有 `allkeys-lru`、`allkeys-lfu` 淘汰策略。
- 浏览器缓存、CDN 边缘节点：空间有限，热数据留下。
- 数据库缓冲池（MySQL Buffer Pool）用改进的 LRU 管理磁盘页。
- 手机 App "最近任务"、搜索历史排序本质也是 LRU 思想。

## 什么时候用

- 面试中被要求"设计一个满足 xx 接口、单操作 O(x) 的结构"。
- 工程中资源有限（内存、连接数）需要缓存淘汰策略时。
- 先想清楚**有哪些不变量**（谁最新、谁频次最低），再倒推需要哪几个结构配合。

## 易错点

- LRU 用单链表删除要找前驱 O(n)，必须用双向链表（或 Python 的 OrderedDict 偷懒，但面试要求手写组合）。
- 双向链表操作后四个指针的更新顺序要保证不断链。
- 淘汰时既要摘链表也要删哈希表（节点存 key 才知道删谁）。
- LFU 中当前最小频次在新增 key 后重置为 1，在旧 key 频次变化时才可能整体抬升。
