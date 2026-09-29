---
slug: p-app-dedup
title: 检索结果的 URL 归一化去重
difficulty: 1
topics: [ds-hash]
tags: [哈希表, URL 归一化, 去重, 网络检索]
entry: dedup_urls
starter_code: |
  def dedup_urls(urls):
      # 归一化每个 URL 后去重，保持首次出现顺序，返回归一化结果
      pass
solution_code: |
  def normalize_url(url):
      rest = url.split("#", 1)[0]              # 丢弃 fragment
      if "?" in rest:
          base, qs = rest.split("?", 1)
          params = sorted(qs.split("&")) if qs else []
          rest = base + ("?" + "&".join(params) if params else "")
      scheme, _, host_path = rest.partition("://")
      host, _, path = host_path.partition("/")
      return f"{scheme.lower()}://{host.lower()}/{path.rstrip('/')}"

  def dedup_urls(urls):
      seen = set()
      out = []
      for u in urls:
          n = normalize_url(u)
          if n not in seen:
              seen.add(n)
              out.append(n)
      return out
tests:
  - desc: 大小写与末尾斜杠归一
    args:
      - ["https://Example.com/a/", "https://example.com/a", "http://example.com/a"]
    expected: ["https://example.com/a", "http://example.com/a"]
  - desc: 查询参数顺序归一
    args:
      - ["https://e.com/p?b=2&a=1", "https://e.com/p?a=1&b=2"]
    expected: ["https://e.com/p?a=1&b=2"]
  - desc: fragment 不参与判重
    args:
      - ["https://e.com/p#sec1", "https://e.com/p"]
    expected: ["https://e.com/p"]
  - desc: 保持首次出现顺序
    args:
      - ["https://b.com/x", "https://a.com/y", "https://B.COM/x/"]
    expected: ["https://b.com/x", "https://a.com/y"]
---

Agent 联网检索时会把多个搜索引擎的结果合并，同一页面常常以不同形态重复出现：host 大小写不一、末尾多了 `/`、查询参数顺序不同、带着 `#锚点`。直接把重复页面塞进上下文既浪费 token 又干扰模型。去重前必须先**归一化**：

1. 丢弃 `#` 及之后的 fragment；
2. 查询参数（`?a=1&b=2`）**排序后重组**（空查询的 `?` 直接去掉）；
3. scheme 与 host 转**小写**；
4. 丢弃路径末尾的 `/`（根路径归一为空路径）。

实现 `dedup_urls(urls)`：对每个 URL 归一化后去重，**保持首次出现顺序**，返回归一化后的 URL 列表（注意：`http` 与 `https` 视为不同地址）。

**提示**：归一化是纯字符串处理，去重的"保持首现顺序"要求决定了不能只输出 `set`——一遍扫描 + 哈希集合判重 + 列表收集。

--- 题解 ---

## 思路：规范化函数 + 哈希判重的一趟扫描

`normalize_url` 按规则逐条处理字符串（先摘 fragment、再排参数、最后小写化 host/scheme、去尾斜杠）。`dedup_urls` 经典三件套：

```text
for u in urls:
    n = normalize(u)
    if n not in seen: seen.add(n); out.append(n)
```

**为什么去重前必须归一化**：`"https://Example.com/a/"` 与 `"https://example.com/a"` 字符串不等但指向同一页面；不归一化的哈希去重对它们无能为力。这体现了哈希去重的真正前提——**判重键必须与"相等"的业务语义一致**（与 p-lc1 哈希表"键怎么选"是同一个思想）。

## 复杂度

- 时间 O(N·L + Σ L·log L)：N 个 URL、均长 L，参数排序按段数。
- 空间 O(N·L)：集合与输出。

## 易错点

- 参数排序排在 **fragment 摘除之后**：`#` 后面可能出现 `&`/`=`，先排参数会把 fragment 内容卷进来。
- 末尾 `/` 只去**路径末尾**的（`rstrip("/")`），路径中间的必须保留。
- 返回的是**归一化后**的 URL（不是原始串），且顺序按首次出现——`set` 无序，必须配列表。
