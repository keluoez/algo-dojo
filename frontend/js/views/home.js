/* 首页 · 学习看板：总览数据、两大入口、继续学习与错题速览。 */
Views.home = {
  async render(root) {
    const [overview, catalog, wrong] = await Promise.all([
      API.get("/api/progress/overview"),
      API.get("/api/catalog"),
      API.get("/api/review/wrong"),
    ]);

    root.innerHTML = "";

    /* Hero */
    const greeting =
      overview.today_attempts > 0
        ? `今天已经提交 ${overview.today_attempts} 次，保持节奏。`
        : "今天还没有动笔，选一个知识点开始吧。";
    root.appendChild(
      h("div", { class: "hero" }, [
        h("h1", {}, "把算法练成肌肉记忆"),
        h("p", {}, greeting + " 概念 → 示例 → 答题 → 复盘，闭环前进。"),
      ])
    );

    /* 统计卡 */
    root.appendChild(
      h("div", { class: "grid cols-4" }, [
        statCard(
          `${overview.topics.learned}<span class="denom"> / ${overview.topics.total}</span>`,
          "已学知识点"
        ),
        statCard(
          `${overview.problems.passed}<span class="denom"> / ${overview.problems.total}</span>`,
          "已通过题目"
        ),
        statCard(overview.today_attempts, "今日判题次数"),
        statCard(overview.quiz_correct, "概念小测答对"),
      ])
    );

    /* 进度条 */
    root.appendChild(
      h("div", { class: "card mt-16" }, [
        h("div", { class: "card-title" }, "学习进度"),
        progressRow(
          "知识点",
          overview.topics.learned,
          overview.topics.total
        ),
        progressRow(
          "编程题",
          overview.problems.passed,
          overview.problems.total,
          true
        ),
      ])
    );

    /* 两大入口 */
    root.appendChild(
      h("div", { class: "grid cols-2 mt-16" },
        catalog.categories.map((cat) =>
          h(
            "a",
            {
              class: "card",
              href: cat.key === "data-structure" ? "#/ds" : "#/algo",
            },
            [
              h("div", { class: "row-between" }, [
                h("div", { class: "card-title" }, cat.title),
                h("span", { class: "badge primary" }, `${cat.topics.length} 个主题`),
              ]),
              h("p", { class: "muted", style: "margin:0" }, cat.desc),
            ]
          )
        )
      )
    );

    /* 错题速览 */
    root.appendChild(buildWrongPanel(wrong.items));
  },
};

function statCard(numHtml, label) {
  return h("div", { class: "card stat-card" }, [
    h("div", { class: "stat-num", html: String(numHtml) }),
    h("div", { class: "stat-label" }, label),
  ]);
}

function progressRow(label, value, total, success) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return h("div", { style: "margin-bottom:14px" }, [
    h("div", { class: "row-between", style: "margin-bottom:6px" }, [
      h("span", {}, label),
      h("span", { class: "muted" }, `${value}/${total}（${pct}%）`),
    ]),
    h("div", { class: `progress-bar${success ? " success" : ""}` }, [
      h("div", { style: `width:${pct}%` }),
    ]),
  ]);
}

function buildWrongPanel(items) {
  if (!items.length) {
    return h("div", { class: "card mt-16" }, [
      h("div", { class: "card-title" }, "错题速览"),
      h("div", { class: "empty", style: "padding:24px" }, [
        h("span", { class: "em-icon" }, "🎉"),
        "错题本是空的，继续保持",
      ]),
    ]);
  }
  return h("div", { class: "card mt-16" }, [
    h("div", { class: "row-between" }, [
      h("div", { class: "card-title" }, "错题速览"),
      h("a", { href: "#/review", class: "muted" }, "查看全部 →"),
    ]),
    h(
      "div",
      {},
      items.slice(0, 5).map((item) =>
        h("div", { class: "row-between", style: "padding:8px 0; border-bottom:1px solid var(--c-border)" }, [
          h("a", { href: `#/problem/${item.slug}` }, item.title),
          h("span", { class: "badge fail" }, `错过 ${item.fail_count} 次`),
        ])
      )
    ),
  ]);
}
