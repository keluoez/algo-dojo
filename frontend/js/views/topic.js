/* 知识点详情：概念正文、概念小测、关联题目与已学标记。 */
Views.topic = {
  async render(root, { slug }) {
    const [topic, allProblems, progressMap, masteryMap] = await Promise.all([
      API.get(`/api/topics/${slug}`),
      API.get("/api/problems"),
      API.get("/api/progress/topics"),
      API.get("/api/progress/problems"),
    ]);

    const learned = progressMap.items.some(
      (i) => i.topic_slug === slug && i.learned
    );
    const masteryBySlug = Object.fromEntries(
      masteryMap.items.map((i) => [i.problem_slug, i])
    );
    const related = topic.related_problems
      .map((pslug) => allProblems.find((p) => p.slug === pslug))
      .filter(Boolean);

    root.innerHTML = "";

    /* 头部 */
    const learnBtn = h(
      "button",
      {
        class: learned ? "btn success" : "btn primary",
        onclick: toggleLearned,
      },
      learned ? "✓ 已标记为学过" : "标记为已学"
    );

    async function toggleLearned() {
      const next = !learnBtn.classList.contains("btn success");
      learnBtn.disabled = true;
      await API.post(`/api/topics/${slug}/mark`, { learned: next });
      Toast.success(next ? "已加入已学清单" : "已取消已学标记");
      learnBtn.disabled = false;
      learnBtn.className = next ? "btn success" : "btn primary";
      learnBtn.textContent = next ? "✓ 已标记为学过" : "标记为已学";
    }

    root.appendChild(
      h("div", { class: "page-head" }, [
        h("div", { class: "row-between" }, [
          h("div", {}, [
            h("h1", { class: "page-title" }, topic.title),
            h("p", { class: "page-desc" }, topic.subtitle),
          ]),
          learnBtn,
        ]),
        h("div", { style: "margin-top:10px; display:flex; gap:8px; flex-wrap:wrap" }, [
          diffBadge(topic.difficulty),
          ...topic.tags.map(tagBadge),
        ]),
      ])
    );

    /* 正文 */
    root.appendChild(h("div", { class: "card" }, mdNode(topic.body_md)));

    /* 基本操作示例：数据结构页的"增删改查到底怎么写"，每条都能现场跑 */
    if (topic.operations && topic.operations.length) {
      root.appendChild(buildOperations(topic));
    }

    /* 动画演示：该知识点有动画就自动挂一个（默认播第一个，其余给入口） */
    const anims = window.AnimPlayer ? window.AnimPlayer.list(slug) : [];
    if (anims.length) {
      const animHost = h("div", { class: "anim-player-host" });
      root.appendChild(
        h("div", { class: "card mt-16 anim-embed-card" }, [
          h("div", { class: "row-between" }, [
            h("div", { class: "card-title", style: "margin:0" }, "动画演示"),
            h("a", { class: "muted", href: "#/anim" }, "全部动画 →"),
          ]),
          h(
            "div",
            { style: "display:flex; gap:6px; flex-wrap:wrap; margin:8px 0 2px" },
            anims.map((a) =>
              h("a", { class: "badge ghost", href: `#/anim/${a.key}` }, a.title)
            )
          ),
          animHost,
        ])
      );
      window.AnimPlayer.mountInto(animHost, anims[0].key, { compact: true });
    }

    /* 概念小测 */
    if (topic.quizzes.length) {
      const quizCard = h("div", { class: "card" }, [
        h("div", { class: "card-title" }, "概念小测 · 看完立刻自检"),
        ...topic.quizzes.map((quiz, index) => buildQuiz(slug, quiz, index)),
      ]);
      root.appendChild(quizCard);
    }

    /* 关联题目 */
    if (related.length) {
      root.appendChild(
        h("div", { class: "card" }, [
          h("div", { class: "card-title" }, "配套练习题"),
          ...related.map((p) => {
            const m = masteryBySlug[p.slug];
            const statusBadge =
              m && m.status === "passed"
                ? h("span", { class: "badge ok" }, "已通过")
                : m
                ? h("span", { class: "badge fail" }, "错题")
                : h("span", { class: "badge" }, "未开始");
            return h(
              "a",
              {
                class: "row-between",
                href: `#/problem/${p.slug}`,
                style: "padding:9px 0; border-bottom:1px solid var(--c-border)",
              },
              [
                h("span", {}, [
                  h("span", { class: "muted", style: "margin-right:8px" },
                    p.lc ? `LC${p.lc}` : "练习"),
                  p.title,
                ]),
                h("span", { style: "display:flex; gap:8px; align-items:center" }, [
                  diffBadge(p.difficulty),
                  statusBadge,
                ]),
              ]
            );
          }),
        ])
      );
    }
  },
};

/* ---------------- 基本操作示例 ---------------- */

const OP_KIND_CLASS = {
  增: "ok",
  删: "fail",
  改: "diff-2",
  查: "primary",
  建: "ghost",
  遍历: "ghost",
  其它: "ghost",
};

function buildOperations(topic) {
  const setupOpen = { value: false };
  const setupBox = h("div", { class: "op-setup", style: "display:none" },
    h("pre", {}, h("code", { class: "language-python" }, topic.ops_setup || "（无）")));

  const toggleBtn = h("button", { class: "btn sm", onclick: () => {
    setupOpen.value = !setupOpen.value;
    setupBox.style.display = setupOpen.value ? "" : "none";
    toggleBtn.textContent = setupOpen.value ? "收起公共定义" : "查看公共定义";
  } }, "查看公共定义");

  return h("div", { class: "card" }, [
    h("div", { class: "row-between" }, [
      h("div", { class: "card-title", style: "margin:0" }, "基本操作 · 每条都能现场跑"),
      h("span", { style: "display:flex; gap:6px; align-items:center" }, [
        h("span", { class: "muted" }, `${topic.operations.length} 个操作`),
        ...(topic.ops_setup ? [toggleBtn] : []),
      ]),
    ]),
    h("p", { class: "muted", style: "margin:6px 0 0" },
      "点「运行」会用浏览器里的 Python 真跑一遍，输出直接显示在代码下方；代码可以随便改。首次运行需加载运行环境，约几秒。"),
    setupBox,
    ...topic.operations.map((op) => buildOperation(topic, op)),
  ]);
}

function buildOperation(topic, op) {
  const initial = `${op.code}\n\n# ---- 演示 ----\n${op.demo}`;
  const host = h("div", { class: "op-editor" });
  const editor = CodeMirror(host, {
    value: initial,
    mode: "python",
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    matchBrackets: true,
    autoCloseBrackets: true,
  });
  const lineCount = initial.split("\n").length;
  editor.setSize(null, Math.min(320, 24 + lineCount * 20));

  const output = h("pre", { class: "op-output" }, "尚未运行");

  const runBtn = h("button", { class: "btn sm primary", onclick: run }, "▶ 运行");
  const resetBtn = h("button", { class: "btn sm", onclick: () => {
    editor.setValue(initial);
    output.className = "op-output";
    output.textContent = "尚未运行";
  } }, "还原");

  async function run() {
    runBtn.disabled = true;
    output.className = "op-output";
    output.textContent = "运行中…";
    // 公共定义（结构定义与辅助函数）不进编辑器，但在运行时自动前置
    const code = topic.ops_setup ? `${topic.ops_setup}\n\n${editor.getValue()}` : editor.getValue();
    try {
      const res = await PyRunner.demo(code);
      if (res.error) {
        output.className = "op-output bad";
        output.textContent = res.error;
      } else {
        output.textContent = res.output || "（运行成功，但没有输出）";
      }
    } catch (e) {
      output.className = "op-output bad";
      output.textContent = String((e && e.message) || e);
    } finally {
      runBtn.disabled = false;
    }
  }

  return h("div", { class: "op-block" }, [
    h("div", { class: "op-head" }, [
      h("span", { class: "badge " + (OP_KIND_CLASS[op.kind] || "ghost") }, op.kind || "其它"),
      h("strong", {}, op.name),
      op.desc ? h("span", { class: "muted" }, op.desc) : null,
    ]),
    host,
    h("div", { class: "editor-bar" }, [runBtn, resetBtn]),
    output,
  ]);
}

function buildQuiz(topicSlug, quiz, index) {
  let answered = false;

  const explain = h("div", { class: "quiz-explain", style: "display:none" }, [
    h("strong", {}, "解析："),
    quiz.explain || "见正文对应概念。",
  ]);

  const options = h(
    "div",
    { class: "quiz-options" },
    quiz.options.map((text, optIndex) => {
      const btn = h("button", { class: "quiz-opt", type: "button" }, [
        h("span", { class: "muted" }, String.fromCharCode(65 + optIndex)),
        h("span", {}, text),
      ]);
      btn.addEventListener("click", async () => {
        if (answered) return;
        answered = true;
        const correct = optIndex === quiz.answer;
        [...options.children].forEach((child, i) => {
          child.disabled = true;
          if (i === quiz.answer) child.classList.add("correct");
          else if (i === optIndex) child.classList.add("wrong");
        });
        explain.style.display = "block";
        try {
          await API.post(`/api/topics/${topicSlug}/quiz`, {
            quiz_index: index,
            correct,
          });
        } catch {
          /* Toast 已提示，不阻断阅读 */
        }
      });
      return btn;
    })
  );

  return h("div", { class: "quiz-item" }, [
    h("div", { class: "quiz-q" }, `${index + 1}. ${quiz.q}`),
    options,
    explain,
  ]);
}
