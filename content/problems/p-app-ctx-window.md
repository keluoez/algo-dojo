---
slug: p-app-ctx-window
title: 对话上下文的 Token 预算裁剪
difficulty: 1
topics: [algo-two-pointers]
tags: [上下文窗口, Token 预算, Agent, 贪心]
entry: trim_context
starter_code: |
  def trim_context(messages, budget):
      # system 消息永远保留；其余从最新往回连续装入，返回保留的消息（原顺序）
      pass
solution_code: |
  def trim_context(messages, budget):
      kept = set()
      used = 0
      for i, m in enumerate(messages):
          if m["role"] == "system":       # system 提示词无条件保留
              kept.add(i)
              used += m["tokens"]
      for i in range(len(messages) - 1, -1, -1):
          if i in kept:
              continue
          if used + messages[i]["tokens"] <= budget:
              kept.add(i)
              used += messages[i]["tokens"]
          else:
              break                       # 保持"最近的连续对话"，不再往前翻
      return [messages[i] for i in range(len(messages)) if i in kept]
tests:
  - desc: 保留 system 与最近一条
    args:
      - - role: system
          tokens: 10
        - role: user
          tokens: 20
        - role: assistant
          tokens: 30
        - role: user
          tokens: 40
      - 75
    expected:
      - role: system
        tokens: 10
      - role: user
        tokens: 40
  - desc: 预算刚好装下全部
    args:
      - - role: system
          tokens: 10
        - role: user
          tokens: 20
        - role: assistant
          tokens: 30
        - role: user
          tokens: 40
      - 100
    expected:
      - role: system
        tokens: 10
      - role: user
        tokens: 20
      - role: assistant
        tokens: 30
      - role: user
        tokens: 40
  - desc: 只装得下 system
    args:
      - - role: system
          tokens: 10
        - role: user
          tokens: 40
      - 35
    expected:
      - role: system
        tokens: 10
  - desc: 没有 system 时从最新往回带
    args:
      - - role: user
          tokens: 10
        - role: assistant
          tokens: 20
      - 25
    expected:
      - role: assistant
        tokens: 20
  - desc: 零预算且无 system
    args:
      - - role: user
          tokens: 10
      - 0
    expected: []
---

Agent 每次调用大模型前，都要把**会话历史**塞进有限的上下文窗口。超了就会被 API 拒绝或被静默截断，所以发送前必须自己裁剪。工程上最常用的策略：

- `system` 消息（角色设定、工具说明）**永远保留**；
- 其余消息**从最新往回**尽量多带，预算（`budget` 个 token）装不下就停——保留"最近的一段连续对话"，而不是从中间掏掉几条（避免语境断裂）；
- 返回保留的消息，**保持原有顺序**。

每条消息形如 `{"role": ..., "tokens": int}`，`tokens` 是该消息的 token 数。实现 `trim_context(messages, budget)`。

**提示**：一遍从尾到头的扫描就够；"保持原顺序返回"意味着先决定**保留下标集合**，再按原顺序取出。

--- 题解 ---

## 思路：两趟扫描——先钉住 system，再从尾部回填

1. 第一趟正向扫：所有 `system` 消息的下标直接进入保留集，token 累计；
2. 第二趟**从最后一条往回**：非 system 消息能装下就保留、装不下就 `break`——注意不是 `continue`，跳过中间某条继续往前装会破坏"连续最近"的语义；
3. 按下标升序输出保留的消息（原顺序自然保持）。

这是所有 Agent 框架上下文管理的第一块基石（LangChain 的 `ConversationBufferWindow`、各类 memory 组件本质都是这个策略加变体）。更精细的策略会做"轮次对齐"（user/assistant 成对丢）或摘要压缩（旧对话滚成 summary），但预算内的贪心回填永远是 fallback。

## 复杂度

- 时间 O(n)：两趟扫描。
- 空间 O(n)：保留集与输出。
- 真实系统中 token 计数本身（tokenizer 编码）比裁剪逻辑贵得多，所以工程上会缓存每条消息的 token 数——正是本题输入直接给 `tokens` 的原因。

## 易错点

- 装不下时是 **break 不是 continue**：保留的必须是最近连续的一段。
- 输出顺序是**原顺序**：从尾部往回收集的话最后要反转（或按下标排序）。
- system 的 token 也要计入预算占用，第一趟别忘记累加。
