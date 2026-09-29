---
slug: p-app-prefix-router
title: 工具网关的最长前缀路由
difficulty: 2
topics: [ds-trie]
tags: [字典树, 最长前缀匹配, 路由, Agent 工具调用]
entry: PrefixRouter
starter_code: |
  class PrefixRouter:
      def __init__(self):
          pass

      def register(self, path, handler):
          # 注册一条路由前缀，如 "/tools/search" -> handler
          pass

      def find(self, path):
          # 返回最长匹配前缀的 handler；无匹配返回 None
          pass
solution_code: |
  class PrefixRouter:
      def __init__(self):
          self.root = {}

      def register(self, path, handler):
          node = self.root
          for seg in path.strip("/").split("/"):
              node = node.setdefault(seg, {})
          node["*"] = handler          # 该前缀对应的处理器

      def find(self, path):
          node = self.root
          best = None
          for seg in path.strip("/").split("/"):
              if seg not in node:
                  break
              node = node[seg]
              if "*" in node:          # 途经的每一层注册点都可能是答案，记住最深的
                  best = node["*"]
          return best
scenarios:
  - steps:
      - {op: register, args: ["/tools", "generic"]}
      - {op: register, args: ["/tools/search", "search"]}
      - {op: register, args: ["/docs", "docs"]}
      - {op: find, args: ["/tools/search/vec"], expected: "search"}
      - {op: find, args: ["/tools/other"], expected: "generic"}
      - {op: find, args: ["/tools"], expected: "generic"}
      - {op: find, args: ["/docs/a/b"], expected: "docs"}
      - {op: find, args: ["/none"], expected: null}
  - steps:
      - {op: register, args: ["/a/b/c", "deep"]}
      - {op: find, args: ["/a/b/c/d/e"], expected: "deep"}
      - {op: find, args: ["/a"], expected: null}
      - {op: find, args: ["/a/b"], expected: null}
      - {op: register, args: ["/a", "root-a"]}
      - {op: find, args: ["/a/b/x"], expected: "root-a"}
  - steps:
      - {op: find, args: ["/x"], expected: null}
---

Agent 平台要暴露几十上百个工具（搜索、代码执行、数据库查询……），网关按**最长前缀匹配**把请求路径路由到处理器：注册了 `/tools` 和 `/tools/search` 两个前缀时，请求 `/tools/search/vec` 命中更具体的 `/tools/search`。前缀匹配按**整段**生效（`/tool` 不匹配 `/tools`）。

实现 `PrefixRouter`：

- `register(path, handler)`：注册前缀（如 `"/tools/search"`）到处理器；
- `find(path)`：返回**最长**匹配前缀的 handler；无任何前缀命中返回 `None`。

**提示**：路径天然是"按 `/` 分段的层级结构"——一棵 Trie。`find` 沿路径逐段下走，途经的每个"注册点"都可能是答案，要记住**最深的那个**。

--- 题解 ---

## 思路：Trie + 下行途中记住最深注册点

把每条注册前缀按 `/` 分段插入 Trie，节点上打 `"*"` 标记存该前缀的 handler。

`find` 的关键观察：答案不必是"路径的某个后缀判断"，而是**下行走过的路上最深的注册点**——沿途每进入一个有 `"*"` 的节点就更新 `best`，走不下去（段不存在）就停。结束时 `best` 就是最长匹配前缀的 handler。

这正是 Nginx `location` 前缀匹配、对象存储路径策略、Agent 工具路由的共同内核。

## 复杂度

- `register` O(L)：L 为前缀段数；`find` O(P)：P 为查询路径段数，**与注册的规则总数无关**——规则上万条时，哈希逐条 `startswith` 是 O(规则数 × 路径长)，Trie 是毫秒级。
- 空间 O(所有前缀总段数)。

## 易错点

- 匹配按**整段**：`/tool` 与 `/tools` 是不同的段，逐段比较天然正确，千万别用字符串 `startswith` 整体比（`"/tool".startswith("/tools")` 恰好是 False，但 `"/tools/x".startswith("/tool")` 是 True，整段语义就错了）。
- `best` 要在**每个途经节点**更新，不是只看最终停下的节点——最长匹配可能在中途。
- `find` 找不到时返回 `None`（Python），别返回空串或抛异常。
