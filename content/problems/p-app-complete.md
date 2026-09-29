---
slug: p-app-complete
title: 搜索框自动补全
difficulty: 2
topics: [ds-trie]
tags: [字典树, 前缀匹配, DFS]
entry: autocomplete
starter_code: |
  def autocomplete(words, prefix, limit):
      # 词表 words（无重复）；返回以 prefix 开头、按字典序的前 limit 个词
      pass
solution_code: |
  def autocomplete(words, prefix, limit):
      root = {}
      for w in words:
          node = root
          for ch in w:
              node = node.setdefault(ch, {})
          node["$"] = True          # 词尾标记

      node = root
      for ch in prefix:
          if ch not in node:
              return []
          node = node[ch]

      out = []

      def dfs(node, path):
          if len(out) >= limit:
              return
          if "$" in node:                       # 先收 shorter，再走更长
              out.append(prefix + "".join(path))
          for ch in sorted(k for k in node if k != "$"):
              dfs(node[ch], path + [ch])

      dfs(node, [])
      return out
tests:
  - desc: 前缀命中多个词
    args: [["app", "apple", "apply", "ban", "banana", "band"], "app", 10]
    expected: ["app", "apple", "apply"]
  - desc: limit 截断
    args: [["app", "apple", "apply", "ban", "banana", "band"], "ban", 2]
    expected: ["ban", "banana"]
  - desc: 前缀不存在
    args: [["app", "apple", "apply", "ban", "banana", "band"], "c", 5]
    expected: []
  - desc: 空前缀 = 全表前 limit
    args: [["app", "apple", "apply", "ban", "banana", "band"], "", 3]
    expected: ["app", "apple", "apply"]
  - desc: 前缀恰好是一个完整词
    args: [["app", "apple", "apply", "ban", "banana", "band"], "bana", 10]
    expected: ["banana"]
  - desc: 单词条表
    args: [["app"], "app", 5]
    expected: ["app"]
---

搜索引擎输入框的**自动补全**：用户敲了几个字符，下拉框立刻给出以它为前缀的候选词（按字典序），最多展示 `limit` 条。候选词来自一个固定词表 `words`（不含重复词，均由小写字母组成）。

实现 `autocomplete(words, prefix, limit)`：返回词表中以 `prefix` 开头的词里，**字典序最小**的 `limit` 个（不足则全部返回）。`prefix` 可能为空串（等于对全表做补全）。

**提示**：每次输入都全表 `startswith` 扫一遍是 O(n·L)。想想字典树（Trie）：沿着 `prefix` 走到对应节点后，候选词全在这个子树里——怎么按字典序"只走够 limit 个就停"？

--- 题解 ---

## 思路：Trie 子树的中序收集

1. 建 Trie：每个节点是"下一字符 → 子节点"的哈希表，词尾打 `$` 标记；
2. 沿 `prefix` 逐字符下走：任何一步走不下去，直接返回空（这是 Trie 相比排序数组二分前缀的优势——**前缀不存在时 O(|prefix|) 就能判定**）；
3. 在落脚节点上 DFS：**先查自己是否词尾（短词优先），再按子节点字符升序深入**。这保证了输出严格字典序；凑满 `limit` 立即剪枝返回。

短词优先不是小事：`"app"` 与 `"apple"` 都是 `app` 前缀的候选，字典序上 `"app" < "apple"`，先收词尾再深入恰好实现这一点。

## 复杂度

- 建树 O(ΣL)（词表总字符数）；查询 O(|prefix| + 输出字符总量)，**与词表大小无关**——词表百万级时，全表扫描与 Trie 子树 DFS 是毫秒与秒的差距。
- 空间 O(ΣL × 字符集指针)。生产实现会把子节点表做压缩（radix tree / 双数组 Trie），思想一致。

## 易错点

- 字典序 = 先词尾、再子节点**升序**，子节点键要 `sorted` 后再递归。
- 剪枝条件 `len(out) >= limit` 在"收词尾后"和"每个子节点递归前"都要检查。
- `prefix` 为空串时落脚点就是根节点，逻辑天然成立，不需要特判。
