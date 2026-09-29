---
slug: ds-linked-list
category: data-structure
title: 链表
subtitle: 用指针串起来的节点序列，插入删除零挪动
order: 2
difficulty: 1
tags: [链表, 快慢指针, 虚拟头节点]
related_problems: [p-lc206, p-lc142, p-lc138, p-lc21]
quizzes:
  - q: 相比数组，链表最突出的优势是？
    options:
      - 已知节点位置时插入/删除为 O(1)，不挪动元素
      - 随机访问更快
      - 内存占用一定更小
      - 天然支持二分查找
    answer: 0
    explain: 链表只需改指针指向；数组要搬移后续元素。
  - q: 单链表找中间节点，一趟遍历的经典方法是？
    options: [快慢指针（慢走1快走2）, 两个指针都走1, 哈希计数, 递归]
    answer: 0
    explain: 快指针到尾时，慢指针恰好在中点。
  - q: 快慢指针判环：若有环，会发生什么？
    options: [快慢指针最终相遇, 快指针一定到达 null, 慢指针先到尾部, 两指针永远同速]
    answer: 0
    explain: 环内快指针每轮缩短与慢指针 1 格距离，必然追上。
  - q: '"虚拟头节点（dummy）"主要解决什么痛点？'
    options:
      - 头节点本身可能被增删，需要统一分支
      - 让链表变双向
      - 加快查找速度
      - 防止内存泄漏
    answer: 0
    explain: 有了 dummy，操作真实头节点和操作其他节点完全一样，不用单独写 if。
ops_setup: |
  class ListNode:
      def __init__(self, val=0, next=None):
          self.val = val
          self.next = next


  def build_list(values):
      dummy = ListNode()
      cur = dummy
      for v in values:
          cur.next = ListNode(v)
          cur = cur.next
      return dummy.next


  def to_list(head):
      out = []
      while head:
          out.append(head.val)
          head = head.next
      return out

operations:
  - name: 头插（push_front）
    kind: 增
    desc: O(1)。新节点指回原头节点，新节点就是新头——必须返回它。
    code: |
      def push_front(head, val):
          node = ListNode(val)
          node.next = head
          return node
    demo: |
      head = build_list([2, 3])
      head = push_front(head, 1)
      print(to_list(head))
    output: "[1, 2, 3]"

  - name: 按下标插入（insert_at）
    kind: 增
    desc: O(n)。先走到待插位置的前一个节点，再改两根指针，顺序不能反。
    code: |
      def insert_at(head, index, val):
          dummy = ListNode(next=head)     # 统一"插在头部"这种边界
          cur = dummy
          for _ in range(index):
              cur = cur.next
          cur.next = ListNode(val, cur.next)   # 先接住后半段，再改前驱
          return dummy.next
    demo: |
      head = build_list([1, 2, 4])
      head = insert_at(head, 2, 3)
      print(to_list(head))
    output: "[1, 2, 3, 4]"

  - name: 按值删除（remove_value）
    kind: 删
    desc: O(n)。dummy 让"删的是头节点"不再需要单独分支。
    code: |
      def remove_value(head, val):
          dummy = ListNode(next=head)
          cur = dummy
          while cur.next:
              if cur.next.val == val:
                  cur.next = cur.next.next     # 跨过它，后半段早挂在它身上
                  break
              cur = cur.next
          return dummy.next
    demo: |
      head = build_list([1, 2, 3, 2])
      head = remove_value(head, 2)    # 只删第一个 2
      print(to_list(head))
    output: "[1, 3, 2]"

  - name: 按下标删除（remove_at）
    kind: 删
    desc: O(n)。同样站在待删节点的前一个位置动手。
    code: |
      def remove_at(head, index):
          dummy = ListNode(next=head)
          cur = dummy
          for _ in range(index):
              cur = cur.next
          cur.next = cur.next.next
          return dummy.next
    demo: |
      head = build_list([1, 2, 3, 4])
      head = remove_at(head, 1)
      print(to_list(head))
    output: "[1, 3, 4]"

  - name: 按下标改值（set_at）
    kind: 改
    desc: 走到第 index 个节点改 val 即可；找位置 O(n)，改本身 O(1)。
    code: |
      def set_at(head, index, val):
          cur = head
          for _ in range(index):
              cur = cur.next
          cur.val = val
          return head
    demo: |
      head = build_list([1, 2, 3])
      head = set_at(head, 1, 20)
      print(to_list(head))
    output: "[1, 20, 3]"

  - name: 按值查找（index_of）
    kind: 查
    desc: O(n)。没有下标可用，只能从头走；找不到返回 -1 而不是 None。
    code: |
      def index_of(head, val):
          cur, i = head, 0
          while cur:
              if cur.val == val:
                  return i
              cur = cur.next
              i += 1
          return -1
    demo: |
      head = build_list([4, 5, 6])
      print(index_of(head, 6), index_of(head, 9))
    output: "2 -1"

  - name: 快慢指针找中点
    kind: 查
    desc: 一趟遍历 O(n)。快指针到尾时慢指针正好在中点，偶数长度落在偏右那个。
    code: |
      def middle(head):
          slow = fast = head
          while fast and fast.next:      # 判空顺序不能反
              slow = slow.next
              fast = fast.next.next
          return slow.val
    demo: |
      print(middle(build_list([1, 2, 3, 4, 5])),
            middle(build_list([1, 2, 3, 4])))
    output: "3 3"
---

## 一句话理解

链表是**若干节点通过指针串联**的线性结构，每个节点存数据和"下一个节点在哪"；节点可以散落在内存各处，插入删除只需改指针、不搬数据。

## 核心概念

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def build_list(values):
    dummy = ListNode()
    cur = dummy
    for v in values:
        cur.next = ListNode(v)
        cur = cur.next
    return dummy.next
```

**时间特性**：访问第 k 个节点必须从头走 k 步 O(k)；但如果已经持有某节点指针，在它旁边插入/删除是 O(1)。

**四个必会手法**：

1. **虚拟头节点 dummy**：在真实头部前面放一个假节点，所有"可能改头"的操作（删除、插入、合并）都不再需要单独处理头节点分支。
2. **快慢指针**：慢指针每轮走 1 步、快指针走 2 步。
   - 快到尾、慢在中点 → 找中点
   - 有环则两指针在环内相遇 → 判环
   - 相遇后从头再来一个同步指针 → 找环入口
3. **反转链表**：迭代版用三个指针（prev / cur / nxt）逐个调头；递归版相信"后一段已经反转好"。
4. **合并**：穿针引线，每次取两个链表中较小的节点接上。

## 现实中的典型案例

- 音乐播放器的**播放队列**：随时在任意位置插入、删除、调整顺序，用链表改动局部指针即可。
- 操作系统的**进程等待队列**、任务调度队列：任务频繁加入和移除。
- 浏览器 **Ctrl+Tab 的历史环**、图片查看器的前后切换（双向链表）。
- 文字编辑器撤销栈的内部节点管理、Linux 内核的 task 调度结构。

## 什么时候用

- 需要频繁在**已知位置**插入/删除、很少按下标随机访问时。
- 数据长度频繁变化且无法预估（数组扩容有整体搬迁成本）。
- 需要 O(1) 在头尾增删 → 双向链表（如 LRU 中配合哈希使用）。

## 易错点

- 断链：改 `next` 指向前先保存后续节点，否则链表后半段丢失。
- 循环条件里 `fast` 和 `fast.next` 的判空顺序不能反。
- 反转后原头节点的 `next` 不会自动变成 `None`，记得显式处理，否则造环。
- 复制带随机指针的链表时，先复制节点再连边，不要在一个循环里同时假设新旧节点都已存在。
