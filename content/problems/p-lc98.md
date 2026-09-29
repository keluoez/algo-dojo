---
slug: p-lc98
lc: 98
title: 验证二叉搜索树
difficulty: 2
topics: [ds-bst]
tags: [中序遍历, 上下界, BST]
entry: is_valid_bst
setup_code: |
  class TreeNode:
      def __init__(self, val=0, left=None, right=None):
          self.val = val
          self.left = left
          self.right = right

  def build_tree(values):
      if not values:
          return None
      nodes = [None if v is None else TreeNode(v) for v in values]
      root = nodes[0]
      queue = [root]
      i = 1
      while queue and i < len(nodes):
          node = queue.pop(0)
          if node is None:
              continue
          node.left = nodes[i]
          if nodes[i] is not None:
              queue.append(nodes[i])
          i += 1
          if i < len(nodes):
              node.right = nodes[i]
              if nodes[i] is not None:
                  queue.append(nodes[i])
              i += 1
      return root
starter_code: |
  def is_valid_bst(root):
      # 满足 BST 性质返回 True
      pass
solution_code: |
  def is_valid_bst(root):
      def validate(node, low, high):
          if node is None:
              return True
          if not (low < node.val < high):
              return False
          return (validate(node.left, low, node.val)
                  and validate(node.right, node.val, high))

      return validate(root, float("-inf"), float("inf"))
tests:
  - desc: 合法 BST
    args_code: "(build_tree([2, 1, 3]),)"
    expected: true
  - desc: 深层藏违例（经典反例）
    args_code: "(build_tree([5, 1, 4, None, None, 3, 6]),)"
    expected: false
  - desc: 空树
    args_code: "(build_tree([]),)"
    expected: true
  - desc: 单节点
    args_code: "(build_tree([1]),)"
    expected: true
  - desc: 含极值
    args_code: "(build_tree([2147483647]),)"
    expected: true
---

判断一棵二叉树是否为**有效二叉搜索树**：每个节点的左子树所有值都严格小于它、右子树所有值都严格大于它。

**提示**：只比较直接孩子为什么不够？怎样把"整棵子树必须落在某个取值范围"作为参数递归？

--- 题解 ---

## 思路一：上下界递归（参考实现）

给每个子树带 `(low, high)` 开区间：节点值必须落在区间内。走左子树把上界压成 node.val，走右子树把下界抬成 node.val。这样左子树深处任何违例都逃不掉。

用 None 表示无界比用具体整数更稳（避免极值节点误判），本例用 inf 同理。

## 思路二：中序遍历必须单调

BST 中序严格递增，边遍历边比较"前一个值 ≥ 当前值"即非法。

## 复杂度

- 时间 O(n)；空间 O(n)（递归栈）。

## 易错点

- 只比左右孩子会漏掉深层违例（第二号测试就是专门反例）。
- 注意是严格不等：BST 通常不允许相等。
