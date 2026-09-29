---
slug: ds-binary-tree
category: data-structure
title: 二叉树与遍历
subtitle: 每个节点最多两个孩子，递归思维的最佳训练场
order: 5
difficulty: 2
tags: [二叉树, 递归, 层序遍历]
related_problems: [p-lc94]
quizzes:
  - q: 一棵有 n 个节点的二叉树，递归访问所有节点的时间复杂度是？
    options: [O(n), O(log n), O(n log n), O(n²)]
    answer: 0
    explain: 每个节点恰好被访问常数次。
  - q: 前序、中序、后序遍历的区别在于？
    options:
      - 访问根节点相对于左右子树的时机
      - 是否访问叶子节点
      - 是否使用队列
      - 树的高度计算方式
    answer: 0
    explain: 前序根→左→右，中序左→根→右，后序左右→根。
  - q: 层序遍历（按层输出）借助什么数据结构实现？
    options: [队列, 栈, 哈希表, 并查集]
    answer: 0
    explain: 节点出队时把它的孩子入队，天然按层推进。
  - q: 写递归遍历函数时，最应该先想清楚的是？
    options:
      - 递归函数对"以当前节点为根的子树"负责什么
      - 总节点数是奇数还是偶数
      - 用不用全局变量
      - 树存在数组还是文件
    answer: 0
    explain: 定义好子问题与 base case（空节点），递归自然成立。
ops_setup: |
  from collections import deque


  class TreeNode:
      def __init__(self, val=0, left=None, right=None):
          self.val = val
          self.left = left
          self.right = right


  def build_tree():
      #        1
      #       / \
      #      2   3
      #     / \
      #    4   5
      return TreeNode(1,
                      TreeNode(2, TreeNode(4), TreeNode(5)),
                      TreeNode(3))

operations:
  - name: 前序遍历（根 → 左 → 右）
    kind: 遍历
    desc: O(n)。先访问自己再递归子树，适合"从上往下"复制或序列化一棵树。
    code: |
      def preorder(root):
          if not root:
              return []
          return [root.val] + preorder(root.left) + preorder(root.right)
    demo: |
      print(preorder(build_tree()))
    output: "[1, 2, 4, 5, 3]"

  - name: 中序遍历（左 → 根 → 右）
    kind: 遍历
    desc: O(n)。套在 BST 上就是升序序列，这是它最重要的用途。
    code: |
      def inorder(root):
          if not root:
              return []
          return inorder(root.left) + [root.val] + inorder(root.right)
    demo: |
      print(inorder(build_tree()))
    output: "[4, 2, 5, 1, 3]"

  - name: 后序遍历（左 → 右 → 根）
    kind: 遍历
    desc: O(n)。子树先算完再处理根，适合"从下往上"求高度、释放资源。
    code: |
      def postorder(root):
          if not root:
              return []
          return postorder(root.left) + postorder(root.right) + [root.val]
    demo: |
      print(postorder(build_tree()))
    output: "[4, 5, 2, 3, 1]"

  - name: 层序遍历（BFS）
    kind: 遍历
    desc: O(n)。队列按层推进，天然给出"第几层"的信息，递归做不了这件事。
    code: |
      def level_order(root):
          if not root:
              return []
          out, queue = [], deque([root])
          while queue:
              node = queue.popleft()
              out.append(node.val)
              if node.left:
                  queue.append(node.left)
              if node.right:
                  queue.append(node.right)
          return out
    demo: |
      print(level_order(build_tree()))
    output: "[1, 2, 3, 4, 5]"

  - name: 求最大深度
    kind: 查
    desc: O(n)。深度 = 1 + 左右子树深度的较大者，空节点是 0。
    code: |
      def max_depth(root):
          if not root:
              return 0
          return 1 + max(max_depth(root.left), max_depth(root.right))
    demo: |
      print(max_depth(build_tree()), max_depth(TreeNode(1)))
    output: "3 1"

  - name: 按值查找节点
    kind: 查
    desc: O(n)。找到就短路返回，找不到返回 None；or 的短路让右子树不必白跑。
    code: |
      def find(root, val):
          if not root:
              return None
          if root.val == val:
              return root
          return find(root.left, val) or find(root.right, val)
    demo: |
      node = find(build_tree(), 5)
      print(node.val if node else None, find(build_tree(), 9))
    output: "5 None"

  - name: 统计节点个数
    kind: 查
    desc: O(n)。任何"遍历一遍数一数"的问题都能套这个骨架。
    code: |
      def count_nodes(root):
          if not root:
              return 0
          return 1 + count_nodes(root.left) + count_nodes(root.right)
    demo: |
      print(count_nodes(build_tree()))
    output: "5"

  - name: 镜像翻转（原地改指针）
    kind: 改
    desc: O(n)。交换左右孩子再递归，改的是指针而不是值，不需要新树。
    code: |
      def invert(root):
          if not root:
              return None
          root.left, root.right = invert(root.right), invert(root.left)
          return root
    demo: |
      root = invert(build_tree())
      # 翻转后：根还是 1，左子树变成原来的右子树 3，右子树是 2(5, 4)
      print(root.val, root.left.val, root.right.val,
            root.right.left.val, root.right.right.val)
    output: "1 3 2 5 4"

  - name: 按层序插入（保持完全二叉树）
    kind: 增
    desc: O(n)。用队列找到第一个缺孩子的节点挂上去，这样树不会往一边歪。
    code: |
      def insert_level_order(root, val):
          node = TreeNode(val)
          if not root:
              return node
          queue = deque([root])
          while queue:
              cur = queue.popleft()
              if not cur.left:
                  cur.left = node
                  return root
              if not cur.right:
                  cur.right = node
                  return root
              queue.append(cur.left)
              queue.append(cur.right)
    demo: |
      root = insert_level_order(build_tree(), 6)   # 补在 3 的左孩子上
      print(root.right.left.val, root.right.right)
    output: "6 None"

  - name: 删除叶子节点
    kind: 删
    desc: O(n)。找到它再让父节点把这条指针置空；非叶子得先安置孩子，这里只摘叶子。
    code: |
      def remove_leaf(root, val):
          def dfs(node, parent):
              if not node:
                  return False
              if node.val == val and not node.left and not node.right:
                  if parent.left is node:
                      parent.left = None
                  else:
                      parent.right = None
                  return True
              return dfs(node.left, node) or dfs(node.right, node)

          if root and root.val == val and not root.left and not root.right:
              return None                       # 整棵树只剩一个根
          dfs(root, None)
          return root
    demo: |
      root = remove_leaf(build_tree(), 4)
      print(root.left.left, root.left.right.val)
    output: "None 5"
---

## 一句话理解

二叉树是**每个节点最多有左右两个孩子**的层级结构；树的定义本身就是递归的，所以树是练习"把问题交给子树"思维最好的素材。

## 核心概念

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
```

**递归遍历（DFS 深度优先）**：只区分处理根的时机。

```python
def inorder(node, result):
    if node is None:                    # base case
        return
    inorder(node.left, result)          # 左
    result.append(node.val)             # 根
    inorder(node.right, result)         # 右
```

- 前序：根 → 左 → 右（适合"先处理自己再下发"）
- 中序：左 → 根 → 右（BST 中序是有序序列）
- 后序：左 → 右 → 根（适合"先收集子树结果再汇总"，如求高度）

**迭代遍历**：显式栈模拟递归。中序的经典写法是一路向左压栈，走不动了弹出访问、再转右子树。

**层序遍历（BFS 广度优先）**：队列实现；每轮开始时队列长度就是当前层节点数，可按层分组：

```python
from collections import deque

def level_order(root):
    if not root:
        return []
    queue, result = deque([root]), []
    while queue:
        level = []
        for _ in range(len(queue)):     # 关键：只处理当前层
            node = queue.popleft()
            level.append(node.val)
            if node.left: queue.append(node.left)
            if node.right: queue.append(node.right)
        result.append(level)
    return result
```

## 现实中的典型案例

- **组织结构树 / 文件目录**：展开全部子目录就是 DFS，按层级展示就是 BFS。
- 编译器的**抽象语法树 AST**：递归遍历完成解析与生成代码（和你做 Transformer 里的结构也相通）。
- HTML/XML 的 DOM 树渲染。
- 评论区的盖楼、游戏技能树、决策树模型。
- 中缀表达式求值的表达式树。

## 什么时候用

- 数据天然有层级和归属关系时。
- 需要按层级扩散（最短层数、逐层处理）→ BFS。
- 需要"子树结果向上汇总"（高度、平衡判断、路径和）→ 后序思想的递归。
- 需要"父节点信息先下发"（序列化、复制、路径记录）→ 前序思想。

## 易错点

- 忘记 base case：`node is None` 必须最先判断。
- 递归里用全局列表收集结果时，清楚每个子调用在往里写什么。
- BFS 按层分组时，用进入循环时的队列快照长度，不要用动态长度。
- Python 默认递归深度约 1000，极端倾斜的树会 RecursionError，改用迭代。
