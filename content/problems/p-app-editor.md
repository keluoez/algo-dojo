---
slug: p-app-editor
title: 文本编辑器的撤销与重做
difficulty: 2
topics: [ds-stack-queue]
tags: [栈, 双栈, 撤销重做]
entry: Editor
starter_code: |
  class Editor:
      def __init__(self):
          pass

      def type(self, ch):
          # 在末尾输入一个字符
          pass

      def backspace(self):
          # 删除末尾一个字符（空文本时无操作）
          pass

      def undo(self):
          # 撤销最近一次 type/backspace（无可撤销时无操作）
          pass

      def redo(self):
          # 重做最近一次被撤销的操作（无时可无操作）
          pass

      def text(self):
          # 返回当前文本
          pass
solution_code: |
  class Editor:
      def __init__(self):
          self.buf = []      # 当前文本（字符列表，便于末尾增删）
          self.done = []     # 已执行的操作栈：("type", ch) / ("del", ch)
          self.undone = []   # 已撤销的操作栈，供重做

      def type(self, ch):
          self.buf.append(ch)
          self.done.append(("type", ch))
          self.undone = []           # 产生新操作后，重做历史作废

      def backspace(self):
          if self.buf:
              ch = self.buf.pop()
              self.done.append(("del", ch))
              self.undone = []

      def undo(self):
          if not self.done:
              return
          op, ch = self.done.pop()
          if op == "type":
              self.buf.pop()         # 撤销输入 = 删掉末尾
          else:
              self.buf.append(ch)    # 撤销删除 = 加回来
          self.undone.append((op, ch))

      def redo(self):
          if not self.undone:
              return
          op, ch = self.undone.pop()
          if op == "type":
              self.buf.append(ch)
          else:
              self.buf.pop()
          self.done.append((op, ch))

      def text(self):
          return "".join(self.buf)
scenarios:
  - steps:
      - {op: type, args: ["a"]}
      - {op: type, args: ["b"]}
      - {op: type, args: ["c"]}
      - {op: text, args: [], expected: "abc"}
      - {op: undo, args: []}
      - {op: text, args: [], expected: "ab"}
      - {op: undo, args: []}
      - {op: text, args: [], expected: "a"}
      - {op: redo, args: []}
      - {op: text, args: [], expected: "ab"}
      - {op: redo, args: []}
      - {op: text, args: [], expected: "abc"}
  - steps:
      - {op: type, args: ["a"]}
      - {op: type, args: ["b"]}
      - {op: backspace, args: []}
      - {op: text, args: [], expected: "a"}
      - {op: undo, args: []}
      - {op: text, args: [], expected: "ab"}
      - {op: redo, args: []}
      - {op: text, args: [], expected: "a"}
      - {op: type, args: ["c"]}
      - {op: text, args: [], expected: "ac"}
  - steps:
      - {op: type, args: ["a"]}
      - {op: type, args: ["b"]}
      - {op: undo, args: []}
      - {op: text, args: [], expected: "a"}
      - {op: type, args: ["c"]}
      - {op: text, args: [], expected: "ac"}
      - {op: redo, args: []}
      - {op: text, args: [], expected: "ac"}
  - steps:
      - {op: backspace, args: []}
      - {op: undo, args: []}
      - {op: redo, args: []}
      - {op: text, args: [], expected: ""}
---

你在实现一个轻量代码编辑器的**撤销 / 重做**功能。编辑器只支持两个编辑动作：

- `type(ch)`：在文本末尾输入一个字符；
- `backspace()`：删除末尾一个字符（文本为空时什么也不做）。

在此之上提供：

- `undo()`：撤销最近一次**尚未被撤销**的编辑动作；
- `redo()`：重做最近一次被撤销的动作（若撤销后又发生了新的编辑，重做历史清空，这是所有主流编辑器的行为）；
- `text()`：返回当前文本。

**提示**：撤销和重做本质是两个方向相反的栈——"操作历史"入 `done` 栈，撤销就是把栈顶搬到 `undone` 栈，重做就是搬回来。栈里存什么？存"操作本身"（类型 + 涉及的字符），而不是整个文本快照。

--- 题解 ---

## 思路：双栈 + 可逆操作

把每个编辑动作记成一条可逆记录：`("type", ch)` 或 `("del", ch)`（删除时顺手存下被删的字符，否则撤销时不知道加回什么）。

- **undo**：从 `done` 弹出栈顶记录，执行它的**逆操作**（type ↔ 删末尾，del ↔ 加回末尾），记录压入 `undone`；
- **redo**：从 `undone` 弹回 `done`，重新执行该操作；
- **新编辑**（type/backspace）：压入 `done` 的同时**清空 `undone`**——时间线上分了叉，被撤销的动作不可能再"重做"回来，这正是撤销重做语义的核心。

为什么 `undo` 里 `type` 的逆操作敢直接 `buf.pop()`？因为 undo 只作用于**最近一次**操作，此刻末尾字符必然就是当初输入的那个字符——栈的 LIFO 顺序保证了这一点。

## 复杂度

- 每个操作 O(1)；空间 O(n)（操作历史与文本同阶）。
- 对比"每次存整份文本快照"的写法：那种写法一次 undo O(n)，且 n 次编辑要 O(n²) 空间。

## 易错点

- 新编辑后必须清空 `undone`，否则"撤销→新输入→重做"会出现时间线错乱。
- `backspace` 要把被删的字符存进记录，否则 del 无法撤销。
- 空文本 `backspace`、无历史 `undo`、无可重做 `redo` 都要安静返回，不能抛异常。
