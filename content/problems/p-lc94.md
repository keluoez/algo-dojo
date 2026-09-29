---
slug: p-lc94
lc: 94
title: 二叉树的中序遍历
difficulty: 1
topics: [ds-binary-tree]
tags: [递归, 迭代, 栈]
entry: inorder_traversal
setup_code: |
  class TreeNode:
      def __init__(self, val=0, left=None, right=None):
          self.val = val
          self.left = left
          self.right = right

  def build_tree(values):
      # 层序数组（None 表示空位）构造二叉树
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
  def inorder_traversal(root):
      # 返回中序遍历值列表
      pass
solution_code: |
  def inorder_traversal(root):
      result = []

      def dfs(node):
          if node is None:
              return
          dfs(node.left)
          result.append(node.val)
          dfs(node.right)

      dfs(root)
      return result
tests:
  - desc: 基础示例
    args_code: "(build_tree([1, None, 2, 3]),)"
    expected: [1, 3, 2]
  - desc: 空树
    args_code: "(build_tree([]),)"
    expected: []
  - desc: 完全树
    args_code: "(build_tree([1, 2, 3, 4, 5]),)"
    expected: [4, 2, 5, 1, 3]
  - desc: 只走左链
    args_code: "(build_tree([3, 2, None, 1]),)"
    expected: [1, 2, 3]
---

给定二叉树根节点，返回它的**中序遍历**（左 → 根 → 右）结果列表。

**提示**：递归版是模板；进阶用显式栈写迭代版——一路向左压栈，走不动时弹出、访问、转右。

--- 题解 ---

## 思路一：递归（参考实现）

dfs 先深入左子树，回到当前节点时写值，再深入右子树；空节点是 base case。

## 思路二：显式栈迭代

```python
def inorder_traversal(root):
    result, stack, cur = [], [], root
    while stack or cur is not None:
        while cur is not None:           # 一路向左
            stack.append(cur)
            cur = cur.left
        cur = stack.pop()
        result.append(cur.val)           # 左走不动才访问根
        cur = cur.right                  # 转右子树
    return result
```

## 复杂度

- 时间 O(n)：每个节点进出栈常数次。
- 空间 O(n)：最坏倾斜树栈深 n；递归同样。

## 易错点

- 迭代版外层循环条件是 `stack 非空 或 cur 非空`。
- 递归收集列表要么用闭包 result，要么让 dfs 返回列表再拼接。
