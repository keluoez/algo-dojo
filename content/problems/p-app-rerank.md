---
slug: p-app-rerank
title: 多路召回的融合去重
difficulty: 2
topics: [ds-hash]
tags: [RAG, 多路召回, 融合去重, 哈希表]
entry: merge_recall
starter_code: |
  def merge_recall(lists, k):
      # lists: 每路为 [文档id, 分数] 的降序列表；返回全局 Top-K 的文档 id
      pass
solution_code: |
  def merge_recall(lists, k):
      best = {}                      # 文档 id -> 各路中的最高分
      for lst in lists:
          for doc_id, score in lst:
              if doc_id not in best or score > best[doc_id]:
                  best[doc_id] = score
      ranked = sorted(best.items(), key=lambda kv: (-kv[1], kv[0]))
      return [doc_id for doc_id, _ in ranked[:max(0, k)]]
tests:
  - desc: 跨路去重取最高分
    args:
      - - - ["d1", 0.9]
          - ["d2", 0.8]
        - - ["d2", 0.95]
          - ["d3", 0.7]
      - 2
    expected: ["d2", "d1"]
  - desc: 同分按文档 id 升序
    args:
      - - - ["a", 0.5]
        - - ["b", 0.5]
      - 1
    expected: ["a"]
  - desc: k 超过文档总数
    args:
      - - - ["x", 0.1]
          - ["y", 0.3]
        - - ["z", 0.2]
      - 10
    expected: ["y", "z", "x"]
  - desc: 同一文档多路出现保留最高
    args:
      - - - ["d", 0.3]
          - ["e", 0.4]
        - - ["d", 0.9]
      - 2
    expected: ["d", "e"]
---

Agent 的检索系统通常**多路召回**：向量库、关键词倒排、历史缓存各自返回一份"按相关度降序"的 `(文档id, 分数)` 列表。三路结果往往大量重叠（同一篇文档被多路同时召回），送给大模型前需要**融合**：

- 同一文档取各路中的**最高分**；
- 然后全局按分数降序取前 k 个；同分按文档 id 字典序升序。

实现 `merge_recall(lists, k)`：`lists` 是若干路召回列表，返回融合去重后的 Top-K 文档 id。

**提示**：三路各自有序，但"跨路去重取最大"不是归并问题——先想清楚用什么结构把"同一文档的多个分数"收拢成一个。

--- 题解 ---

## 思路：哈希收拢（id → 最高分），再排序取前 k

多路归并（heapq.merge）适合"k 个有序流拼成一个有序流"；但这里同一文档会**跨路重复**，归并前必须先去重。用哈希表一遍扫完：`best[doc_id] = max(各路分数)`。

然后对去重后的 m 个文档排序取前 k：排序键 `(-分数, 文档id)`，恰好实现"分数降序、同分 id 升序"。

## 复杂度

- 时间 O(M + m log m)：M 是各路结果总数（每个元素一次哈希更新），m 是去重后文档数。
- 空间 O(m)。
- 生产系统里分数来自不同检索器时量纲不一致，会先做归一化或改用 RRF（倒数排名融合，只看排名不看分值）——但"哈希去重取最优"这一步是不变的骨架。

## 易错点

- 去重规则是"取**最高**分"不是"取最后出现"：更新条件必须显式比较分数。
- 排序键把分数取负，同分时 id 不取负——两个方向别搞混。
- k 可能为 0 或超过文档数：`max(0, k)` 与切片天然处理，无需特判（但别让负 k 进切片产生诡异结果）。
