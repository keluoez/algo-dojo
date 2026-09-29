---
slug: p-lc21
lc: 21
title: 合并两个有序链表
difficulty: 1
topics: [ds-linked-list]
tags: [链表, 双指针, dummy]
entry: merge_two_lists
setup_code: |
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
result_adapter: |
  def adapt(result):
      values = []
      cur = result
      while cur is not None:
          values.append(cur.val)
          cur = cur.next
      return values
starter_code: |
  def merge_two_lists(list1, list2):
      # 两个链表均非递减，返回合并后的头节点
      pass
solution_code: |
  def merge_two_lists(list1, list2):
      dummy = ListNode()
      tail = dummy
      while list1 is not None and list2 is not None:
          if list1.val <= list2.val:
              tail.next = list1
              list1 = list1.next
          else:
              tail.next = list2
              list2 = list2.next
          tail = tail.next
      tail.next = list1 if list1 is not None else list2   # 剩余整段接上
      return dummy.next
tests:
  - desc: 基础示例
    args_code: "(build_list([1, 2, 4]), build_list([1, 3, 4]))"
    expected: [1, 1, 2, 3, 4, 4]
  - desc: 一个为空
    args_code: "(None, build_list([0]))"
    expected: [0]
  - desc: 两个都空
    args_code: "(None, None)"
    expected: []
  - desc: 一长一短
    args_code: "(build_list([1, 2, 3]), build_list([4, 5, 6, 7]))"
    expected: [1, 2, 3, 4, 5, 6, 7]
---

两个非递减单链表，请把它们合并为一个非递减链表并返回头节点。

**提示**：dummy 头 + "穿针引线"；循环结束后别忘了剩下的一整段。

--- 题解 ---

## 思路：双指针 + dummy

两个指针分别指向待处理头，每轮比较节点值，较小者接到结果尾部并前进。dummy 让合并结果不用单独处理"第一个节点"。

关键收尾：一方走完，另一方剩余部分已经有序，直接整段挂上。

## 复杂度

- 时间 O(n+m)：每个节点被接一次。
- 空间 O(1)：复用原节点，没有新建节点（dummy 除外）。

## 易错点

- 是"接节点"不是"接值"：移动指针、改 tail.next。
- tail 每次要前进，否则结果链表出现环。
