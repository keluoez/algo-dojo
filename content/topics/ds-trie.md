---
slug: ds-trie
category: data-structure
title: 字典树 Trie
subtitle: 按字符共享前缀的多路叉树，搜索与 NLP 的基础结构
order: 8
difficulty: 2
tags: [Trie, 前缀匹配, NLP, 搜索]
related_problems: [p-lc208, p-app-complete, p-app-prefix-router]
quizzes:
  - q: Trie 中一个节点到另一个节点的边代表什么？
    options: [一个字符, 一个完整单词, 一个下标, 一个哈希值]
    answer: 0
    explain: 沿路径逐字符走，共同前缀共享节点。
  - q: 判断一个长度为 L 的词是否在 Trie 中，时间复杂度是？
    options: [O(L)，与词库大小无关, O(1), O(n log n), O(n·L)]
    answer: 0
    explain: 只走 L 步，每步哈希/查子节点。
  - q: 相比把所有词存进哈希集合，Trie 独有的能力是？
    options:
      - 前缀枚举：给出所有以某串开头的词（自动补全）
      - 一定更省内存
      - 可以存数字
      - 自动排序所有词
    answer: 0
    explain: 沿前缀走到节点后 DFS 收集词尾；哈希表做不到按前缀检索。
  - q: Trie 节点上通常需要一个标记表示？
    options: [是否有单词在此结束, 是否为根节点, 子节点数量, 字符 ASCII 值]
    answer: 0
    explain: 路径存在不代表词存在，需要 is_end 区分 "app" 和 "apple"。
ops_setup: |
  class TrieNode:
      def __init__(self):
          self.children = {}      # 字符 -> 子节点
          self.is_end = False     # 是否有词在这个节点结束


  class Trie:
      def __init__(self):
          self.root = TrieNode()


  def make_trie(words):
      """按词表建好一棵 Trie，演示里用它准备数据（插入逻辑见下方第一个操作）。"""
      trie = Trie()
      for word in words:
          node = trie.root
          for ch in word:
              node = node.children.setdefault(ch, TrieNode())
          node.is_end = True
      return trie

operations:
  - name: 插入单词
    kind: 增
    desc: O(L)，L 是词长。逐字符走，没有就开新分支，结尾打上 is_end。
    code: |
      def trie_insert(trie, word):
          node = trie.root
          for ch in word:
              if ch not in node.children:
                  node.children[ch] = TrieNode()
              node = node.children[ch]
          node.is_end = True          # 不打这个标记，词就不算收录
          return trie
    demo: |
      trie = make_trie(["app", "apple"])
      trie_insert(trie, "banana")
      print(sorted(trie.root.children.keys()))
    output: "['a', 'b']"

  - name: 查找完整单词
    kind: 查
    desc: O(L)。走完所有字符后必须再看 is_end——路径存在不代表词存在。
    code: |
      def search(trie, word):
          node = trie.root
          for ch in word:
              if ch not in node.children:
                  return False
              node = node.children[ch]
          return node.is_end
    demo: |
      trie = make_trie(["app", "apple"])
      print(search(trie, "app"), search(trie, "apple"), search(trie, "ap"))
    output: "True True False"

  - name: 判断前缀
    kind: 查
    desc: O(L)。和查找唯一的区别是不看 is_end，走到哪算哪——输入法联想靠它。
    code: |
      def starts_with(trie, prefix):
          node = trie.root
          for ch in prefix:
              if ch not in node.children:
                  return False
              node = node.children[ch]
          return True
    demo: |
      trie = make_trie(["app", "apple", "banana"])
      print(starts_with(trie, "ap"), starts_with(trie, "ban"), starts_with(trie, "cat"))
    output: "True True False"

  - name: 收集某前缀下的全部单词
    kind: 查
    desc: O(L + m)。先走到前缀终点，再从那里 DFS 把整棵子树收一遍。
    code: |
      def words_with_prefix(trie, prefix):
          node = trie.root
          for ch in prefix:
              if ch not in node.children:
                  return []
              node = node.children[ch]
          out = []

          def dfs(cur, path):
              if cur.is_end:
                  out.append(prefix + path)
              for ch, nxt in cur.children.items():
                  dfs(nxt, path + ch)

          dfs(node, "")
          return sorted(out)
    demo: |
      trie = make_trie(["app", "apple", "application", "banana"])
      print(words_with_prefix(trie, "app"))
    output: "['app', 'apple', 'application']"

  - name: 删除单词
    kind: 删
    desc: O(L)。先取消 is_end，再自底向上把没有孩子也没词的分支摘掉，不留垃圾节点。
    code: |
      def trie_delete(trie, word):
          def dfs(node, i):
              if i == len(word):
                  node.is_end = False
              else:
                  child = node.children.get(word[i])
                  if child is None:
                      return False
                  if dfs(child, i + 1):
                      del node.children[word[i]]
              return not node.is_end and not node.children

          dfs(trie.root, 0)
          return trie
    demo: |
      trie = make_trie(["app", "apple"])
      trie_delete(trie, "apple")          # 只删长的那个
      node = trie.root.children["a"].children["p"].children["p"]
      print(node.is_end, node.children)   # app 仍在，apple 多出来的 l、e 已被摘掉
    output: "True {}"

  - name: 最长前缀匹配
    kind: 查
    desc: O(L)。一路走到底，沿途记下最后一个 is_end 的位置——Agent 工具路由就用它。
    code: |
      def longest_prefix(trie, text):
          node, best, path = trie.root, "", ""
          for ch in text:
              if ch not in node.children:
                  break
              node = node.children[ch]
              path += ch
              if node.is_end:
                  best = path            # 只在成词处更新
          return best
    demo: |
      trie = make_trie(["calendar", "calendar.event", "search"])
      print(longest_prefix(trie, "calendar.event.create"))
      print(longest_prefix(trie, "search.web"))
    output: "calendar.event\nsearch"

  - name: 给单词挂附加数据
    kind: 改
    desc: O(L)。只改终点节点上挂载的数据，不动树形结构——词频、释义、路由处理器都挂在这里。
    code: |
      def set_payload(trie, word, payload):
          node = trie.root
          for ch in word:
              if ch not in node.children:
                  return False
              node = node.children[ch]
          if not node.is_end:
              return False             # 没收录过的词不给挂
          node.payload = payload
          return True


      def get_payload(trie, word):
          node = trie.root
          for ch in word:
              if ch not in node.children:
                  return None
              node = node.children[ch]
          return getattr(node, "payload", None)
    demo: |
      trie = make_trie(["hi", "hot"])
      print(set_payload(trie, "hi", {"freq": 30}), set_payload(trie, "abc", 1))
      print(get_payload(trie, "hi"), get_payload(trie, "hot"))
    output: "True False\n{'freq': 30} None"
---

## 一句话理解

Trie 是一棵**边代表字符、路径代表字符串**的树；拥有相同前缀的词共享同一条路径，所以前缀相关的操作特别高效。

## 核心概念

```python
class TrieNode:
    def __init__(self):
        self.children = {}     # 字符 -> TrieNode
        self.is_end = False    # 是否有词在此结束

class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word):
        node = self.root
        for ch in word:
            node = node.children.setdefault(ch, TrieNode())
        node.is_end = True

    def search(self, word):
        node = self._walk(word)
        return node is not None and node.is_end

    def starts_with(self, prefix):
        return self._walk(prefix) is not None

    def _walk(self, text):
        node = self.root
        for ch in text:
            if ch not in node.children:
                return None
            node = node.children[ch]
        return node
```

**关键细节**：

- 查"词在不在"必须检查 `is_end`：只走得通路径只说明是某个词的前缀。
- **前缀枚举**：走到前缀节点后 DFS，收集所有带 `is_end` 的路径——这就是搜索框联想词的原理。
- 复杂度只和**查询串长度**有关，与词库规模无关；空间上大量共享前缀时比逐词存储更省，但前缀都不相同也可能更费。

## 现实中的典型案例

- **搜索框自动补全 / 输入法联想**：输入"机器学"，列出"机器学习/机器人"。
- 路由器的 **最长前缀匹配**（IP 地址查表）、Linux 内核的 radix tree。
- 编译器/编辑器的代码自动补全、拼写检查。
- NLP 中的中文分词词典加速、敏感词过滤（AC 自动机 = Trie + 失配指针，可一次扫描命中全部敏感词）。
- 生物信息学中 DNA 序列的前缀检索。

## 什么时候用

- 需要**前缀查询 / 前缀枚举 / 自动补全**。
- 大量字符串且共享前缀明显。
- 需要一次扫描匹配多个模式词 → Trie 升级版 AC 自动机。
- 只是精确查词是否存在，哈希集合更简单，不必上 Trie。

## 易错点

- 忘记 `is_end` 会把前缀误判成完整词。
- 用 list[26] 存孩子时只适合纯小写英文字母；中英混合或 Unicode 用 dict 更通用。
- 前缀枚举 DFS 时要带着"当前拼出的词"递归，命中 `is_end` 才加入结果。
- 插入路径上已有的字符不要重建节点，用 setdefault 复用。
