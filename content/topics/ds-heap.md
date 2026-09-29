---
slug: ds-heap
category: data-structure
title: 堆与优先队列
subtitle: 数组表示的完全二叉树，TopK 问题的核心
order: 7
difficulty: 2
tags: [堆, 优先队列, TopK]
related_problems: [p-lc215, p-app-hotsearch, p-app-merge-logs, p-lc253, p-app-vector-search]
quizzes:
  - q: 小顶堆的堆顶（第一个元素）是什么？
    options: [整个集合的最小值, 最大值, 中位数, 平均值]
    answer: 0
    explain: 堆保证每个父节点都不大于孩子，根自然最小。
  - q: Python 中操作堆的标准库是？建堆方法是？
    options: [heapq；heapq.heapify, queue；Queue, collections；deque, bisect；insort]
    answer: 0
    explain: heapq 提供小顶堆，大顶堆用取负值技巧。
  - q: 在 n 个数里维护一个大小为 k 的堆求 TopK，总时间是？
    options: [O(n log k), O(n²), O(n), O(k²)]
    answer: 0
    explain: 每个元素进出堆代价 log k。
  - q: 用堆在数据流中求第 k 大，堆的大小应维护为？
    options: [k, n, k², 不限制]
    answer: 0
    explain: 堆顶就是第 k 大，后续比较堆顶决定去留。
ops_setup: |
  import heapq

operations:
  - name: 自底向上建堆（手写下沉）
    kind: 建
    desc: O(n)。从最后一个非叶子往前下沉；逐个插入反而是 O(n log n)。
    code: |
      def sift_down(arr, i, n):
          while True:
              smallest = i
              left, right = 2 * i + 1, 2 * i + 2
              if left < n and arr[left] < arr[smallest]:
                  smallest = left
              if right < n and arr[right] < arr[smallest]:
                  smallest = right
              if smallest == i:
                  break
              arr[i], arr[smallest] = arr[smallest], arr[i]
              i = smallest


      def heapify(arr):
          for i in range(len(arr) // 2 - 1, -1, -1):   # 最后一个非叶子往前
              sift_down(arr, i, len(arr))
          return arr
    demo: |
      print(heapify([5, 3, 8, 1, 2]))
    output: "[1, 2, 8, 3, 5]"

  - name: heapq.heapify 建堆
    kind: 建
    desc: O(n)，原地。Python 标准库只有小顶堆，要最大堆就把值取负数。
    code: |
      def build_heap(arr):
          heapq.heapify(arr)
          return arr
    demo: |
      print(build_heap([5, 3, 8, 1, 2]))
    output: "[1, 2, 8, 3, 5]"

  - name: 插入（heappush）
    kind: 增
    desc: O(log n)。放到末尾再上浮，只影响这一条路径上的祖先。
    code: |
      def push(heap, x):
          heapq.heappush(heap, x)
          return heap
    demo: |
      heap = [1, 3, 5]
      push(heap, 2)
      push(heap, 0)
      print(heap)
    output: "[0, 1, 5, 3, 2]"

  - name: 弹出堆顶（heappop）
    kind: 删
    desc: O(log n)。拿走堆顶后用末尾元素补位再下沉；拿到的永远是最小值。
    code: |
      def pop(heap):
          return heapq.heappop(heap)
    demo: |
      heap = [1, 2, 5, 6, 3]
      print(pop(heap), pop(heap), heap)
    output: "1 2 [3, 6, 5]"

  - name: 看堆顶
    kind: 查
    desc: O(1)。heap[0] 就是最小值，不需要弹出，也不用遍历。
    code: |
      def peek(heap):
          return heap[0] if heap else None
    demo: |
      print(peek([1, 2, 5, 6, 3]), peek([]))
    output: "1 None"

  - name: 修改元素后重新上浮
    kind: 改
    desc: O(log n)。把某个元素改小，它只需要跟祖先比较并往上换，不会牵动兄弟子树。
    code: |
      def decrease_key(heap, index, value):
          heap[index] = value
          while index:
              parent = (index - 1) // 2
              if heap[parent] <= heap[index]:
                  break
              heap[parent], heap[index] = heap[index], heap[parent]
              index = parent
          return heap
    demo: |
      heap = [1, 3, 5, 7, 9]        # 一个小顶堆
      decrease_key(heap, 3, 0)      # 下标 3 的 7 改成 0，应浮到堆顶
      print(heap)
    output: "[0, 1, 5, 3, 9]"

  - name: TopK：最大的 k 个
    kind: 查
    desc: O(n log k)。维护容量 k 的小顶堆，比堆顶大的才有资格进来。
    code: |
      def top_k(nums, k):
          heap = []
          for x in nums:
              if len(heap) < k:
                  heapq.heappush(heap, x)
              elif x > heap[0]:
                  heapq.heapreplace(heap, x)     # 弹最小 + 压新值，一次调整
          return heap
    demo: |
      print(sorted(top_k([3, 1, 5, 12, 2, 11], 3), reverse=True))
    output: "[12, 11, 5]"

  - name: 堆排序
    kind: 遍历
    desc: O(n log n)，原地。建堆后不断弹堆顶，弹出来的顺序就是升序。
    code: |
      def heap_sort(nums):
          heapq.heapify(nums)
          return [heapq.heappop(nums) for _ in range(len(nums))]
    demo: |
      print(heap_sort([5, 3, 8, 1, 2]))
    output: "[1, 2, 3, 5, 8]"
---

## 一句话理解

堆是**用数组表示的完全二叉树**：小顶堆保证父节点不大于孩子，所以数组第一位永远是全局最小值；逻辑上是树，物理上没有指针、没有节点对象。

## 核心概念

**数组下标关系**（0 基）：节点 i 的左孩子 `2i+1`、右孩子 `2i+2`、父节点 `(i-1)//2`。

**Python heapq**（只有小顶堆）：

```python
import heapq

data = [5, 1, 3, 4, 2]
heapq.heapify(data)          # O(n) 原地建堆
heapq.heappush(data, 0)      # O(log n)
print(heapq.heappop(data))   # 弹出最小值，O(log n)
print(data[0])               # 只看最小值，O(1)

# 大顶堆：存 (优先级, 元素)，优先级取负
```

**堆化（heapify 原理）**：从最后一个非叶子节点向前，逐个"下沉"——与较小孩子比较，比孩子大就交换，直到满足堆性质。插入则"上浮"。

**TopK 两种姿势**：

- 最小的 k 个数：维护**大顶堆**装 k 个候选，新元素比堆顶小就替换堆顶；
- 最大的 k 个数 / 第 k 大：维护**小顶堆**装 k 个候选（堆顶即第 k 大），比堆顶大才进堆。

**优先队列**：堆的应用形态——"优先级最高的先出队"，元素是 `(priority, data)`。

## 现实中的典型案例

- 任务调度：操作系统选**优先级最高**的进程；快递加急件优先派送。
- 定时器管理：网络库用堆找"最早超时"的连接（Dijkstra 也靠堆选最近节点）。
- 热搜榜 / 实时销量 Top10、游戏排行榜前 K。
- 大模型 Beam Search：每轮保留概率最高的 k 个候选（和你的 Agent/AI 方向直接相关）。
- 合并 K 个有序流、Huffman 编码反复取两个最小值。

## 什么时候用

- 反复要"**当前最值**"但不需要全量排序（TopK、流式数据）。
- 按优先级而不是按时间处理任务。
- Dijkstra、Prim 等算法的标配结构。
- 如果只取一次最值，`min/max` O(n) 即可；要反复取并伴随插入删除，堆才划算。

## 易错点

- heapq 只有小顶堆：求最大 K 个时要么取负、要么想清楚堆里装的是什么。
- `heapify` 是 O(n)，比逐个 push（O(n log n)）更优，初始已知全部元素时优先用。
- 堆里放元组时，优先级相同会比较元组后一项，可能报类型错误，可加序号字段。
- TopK 用大小为 k 的堆，别把所有元素都压进去。
