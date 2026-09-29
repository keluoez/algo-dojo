---
slug: ds-bst
category: data-structure
title: 二叉搜索树
subtitle: 左小右大，把二分查找种成一棵树
order: 6
difficulty: 2
tags: [二叉搜索树, 中序遍历, 有序性]
related_problems: [p-lc98]
quizzes:
  - q: 二叉搜索树（BST）的核心性质是？
    options:
      - 左子树都比根小，右子树都比根大
      - 左右子树高度必须相等
      - 所有节点值互不相同且按层递增
      - 叶子只能出现在最后两层
    answer: 0
    explain: 这条性质对每个节点都成立。
  - q: BST 的中序遍历结果有什么特点？
    options: [严格递增（或单调不减）, 严格递减, 随机顺序, 按层排列]
    answer: 0
    explain: 左→根→右正好是从小到大。
  - q: 平衡 BST 中查找一个值的时间复杂度是？
    options: [O(log n), O(1), O(n), O(n log n)]
    answer: 0
    explain: 每比较一次排除一棵子树；树倾斜时才退化 O(n)。
  - q: BST 最主要的工程隐患是？
    options:
      - 按有序序列插入会退化成链表，查找变 O(n)
      - 不能存重复值所以无法计数
      - 中序遍历会无限递归
      - 无法转成数组
    answer: 0
    explain: 需要 AVL/红黑树这类自平衡树来保证高度。
ops_setup: |
  class TreeNode:
      def __init__(self, val=0, left=None, right=None):
          self.val = val
          self.left = left
          self.right = right


  def build_bst():
      #        4
      #       / \
      #      2   6
      #     / \ / \
      #    1  3 5  7
      return TreeNode(4,
                      TreeNode(2, TreeNode(1), TreeNode(3)),
                      TreeNode(6, TreeNode(5), TreeNode(7)))


  def to_level(root):
      """把树按层序摊成列表，演示里用它看结构变化。"""
      if not root:
          return []
      out, queue = [], [root]
      while queue:
          node = queue.pop(0)
          out.append(node.val)
          if node.left:
              queue.append(node.left)
          if node.right:
              queue.append(node.right)
      return out

operations:
  - name: 查找
    kind: 查
    desc: O(h)，h 是树高。每一步都能排除一半子树，这就是"把二分查找种成树"。
    code: |
      def search(root, val):
          if not root or root.val == val:
              return root
          if val < root.val:
              return search(root.left, val)
          return search(root.right, val)
    demo: |
      node = search(build_bst(), 3)
      print(node.val if node else None, search(build_bst(), 9))
    output: "3 None"

  - name: 插入
    kind: 增
    desc: O(h)。一路比大小走到空位，把新节点挂上去；已存在的值直接忽略。
    code: |
      def insert(root, val):
          if not root:
              return TreeNode(val)          # 空位就是插入点
          if val < root.val:
              root.left = insert(root.left, val)
          elif val > root.val:
              root.right = insert(root.right, val)
          return root
    demo: |
      root = insert(build_bst(), 0)
      root = insert(root, 5)                # 已存在，不重复插入
      print(to_level(root))
    output: "[4, 2, 6, 1, 3, 5, 7, 0]"

  - name: 删除
    kind: 删
    desc: O(h)。三种情况：叶子直接删、单孩用孩子顶上、双孩找中序后继顶上再递归删它。
    code: |
      def delete(root, val):
          if not root:
              return None
          if val < root.val:
              root.left = delete(root.left, val)
          elif val > root.val:
              root.right = delete(root.right, val)
          else:
              if not root.left:
                  return root.right
              if not root.right:
                  return root.left
              # 两个孩子：拿右子树最小节点（中序后继）的值顶上
              successor = root.right
              while successor.left:
                  successor = successor.left
              root.val = successor.val
              root.right = delete(root.right, successor.val)
          return root
    demo: |
      root = delete(build_bst(), 2)         # 双孩：后继 3 顶上
      print(to_level(root))
      root = delete(root, 7)                # 叶子：直接摘掉
      print(to_level(root))
    output: "[4, 3, 6, 1, 5, 7]\n[4, 3, 6, 1, 5]"

  - name: 中序遍历（升序输出）
    kind: 遍历
    desc: O(n)。BST 的中序序列一定有序，这是它区别于普通二叉树的根本性质。
    code: |
      def inorder(root):
          if not root:
              return []
          return inorder(root.left) + [root.val] + inorder(root.right)
    demo: |
      print(inorder(build_bst()))
    output: "[1, 2, 3, 4, 5, 6, 7]"

  - name: 最小 / 最大值
    kind: 查
    desc: O(h)。最小值一路向左走到底，最大值一路向右——不用遍历整棵树。
    code: |
      def min_value(root):
          while root.left:                  # 最左
              root = root.left
          return root.val


      def max_value(root):
          while root.right:                 # 最右
              root = root.right
          return root.val
    demo: |
      print(min_value(build_bst()), max_value(build_bst()))
    output: "1 7"

  - name: 第 k 小
    kind: 查
    desc: O(h+k)。用显式栈做中序遍历，不必先把整棵树摊开，找到第 k 个就停。
    code: |
      def kth_smallest(root, k):
          stack, cur = [], root
          while stack or cur:
              while cur:                    # 一路压左链
                  stack.append(cur)
                  cur = cur.left
              cur = stack.pop()
              k -= 1
              if k == 0:
                  return cur.val
              cur = cur.right
    demo: |
      print(kth_smallest(build_bst(), 1), kth_smallest(build_bst(), 3))
    output: "1 3"

  - name: 范围查询
    kind: 查
    desc: O(h+m)，m 是命中数量。整棵子树都小于下界时直接剪掉，不必白跑。
    code: |
      def range_values(root, low, high):
          if not root:
              return []
          if root.val < low:                # 整棵左子树都不可能命中
              return range_values(root.right, low, high)
          if root.val > high:
              return range_values(root.left, low, high)
          return (range_values(root.left, low, high) + [root.val]
                  + range_values(root.right, low, high))
    demo: |
      print(range_values(build_bst(), 2, 5))
    output: "[2, 3, 4, 5]"

  - name: 验证是否合法 BST
    kind: 查
    desc: O(n)。不能只比"左 < 根 < 右"，要把祖先传下来的上下界一起带上。
    code: |
      def is_valid(root, low=float("-inf"), high=float("inf")):
          if not root:
              return True
          if not low < root.val < high:
              return False
          return (is_valid(root.left, low, root.val)
                  and is_valid(root.right, root.val, high))
    demo: |
      bad = TreeNode(4, TreeNode(5), TreeNode(6))   # 左孩子 5 > 根 4，非法
      print(is_valid(build_bst()), is_valid(bad))
    output: "True False"

  - name: 转成累加树（原地改节点值）
    kind: 改
    desc: O(n)。反着走中序（先右后左），把沿途累加值写回节点，改的是值不是结构。
    code: |
      def bst_to_greater(root):
          total = 0

          def dfs(node):
              nonlocal total
              if not node:
                  return
              dfs(node.right)          # 先访问比它大的
              total += node.val
              node.val = total         # 自己变成"大于等于它的全部之和"
              dfs(node.left)

          dfs(root)
          return root
    demo: |
      print(to_level(bst_to_greater(build_bst())))
    output: "[22, 27, 13, 28, 25, 18, 7]"
---

## 一句话理解

二叉搜索树在二叉树基础上加一条规则：**任何节点的左子树都比它小、右子树都比它大**——于是查找过程就是一路"向左还是向右"的二分判断。

## 核心概念

**查找**：从根开始，目标小就走左、大就走右，命中或遇到空为止。

```python
def search_bst(root, target):
    if root is None or root.val == target:
        return root
    if target < root.val:
        return search_bst(root.left, target)
    return search_bst(root.right, target)
```

**中序即排序**：因为左 < 根 < 右，中序遍历天然输出升序序列。很多题（第 k 小、验证 BST）本质是在中序序列上做文章。

**插入**：按查找规则找到空位，新节点挂上去即可，不动其他节点。

**删除**（较难，理解即可）：

- 叶子直接删；
- 只有一个孩子用孩子顶替；
- 有两个孩子时，用**右子树的最小值（或左子树最大值）**顶替自己，再删掉那个顶替节点。

**验证 BST**：不能只比左右孩子，要给每个子树带上**取值上下界**递归；或者利用中序遍历检查是否单调。

## 现实中的典型案例

- Java 的 `TreeMap/TreeSet`、C++ 的 `map/set`：底层是红黑树（自平衡 BST），需要**按 key 有序**遍历、范围查询时使用。
- 数据库的 B+ 树索引（BST 思想的多叉扩展）：范围查询和有序扫描的基础。
- 自动补全中的有序候选集合、Linux CFS 调度器的红黑树管理。
- 排行榜需要"找到某分数前后区间"的场景。

## 什么时候用

- 既需要快速查找、又需要**按 key 有序输出或范围查询**（哈希表给不了顺序）。
- 需要动态插入删除且保持有序。
- 工程上直接用语言自带的平衡树结构，不必手写红黑树；但要能说出"它保证树高 O(log n)"。

## 易错点

- 验证 BST 时只比较直接孩子是错的，左子树深处可能藏着比根大的节点——必须传上下界。
- 普通 BST 按递增顺序插入会退化成一条链，查找变 O(n)。
- 处理边界值（最大/最小整数）时用 `None` 表示无界比用具体哨兵值更稳。
- 删除两孩子节点后，顶替节点同样要按规则从原位置删除。
