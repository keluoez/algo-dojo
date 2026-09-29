/* 编程题工作台：判题、题解、性能实测。 */

/* 性能实测的 ECharts 实例全站只保留一个：
 * 切题或切页时销毁旧的，resize 监听只在模块加载时注册一次。
 * （旧写法每次进题都 addEventListener，且 chart 从不 dispose，
 *   反复进出题目页会不断叠加监听器与图表实例。）
 */
let benchChart = null;

function disposeBenchChart() {
  if (!benchChart) return;
  try {
    benchChart.dispose();
  } catch {
    /* 容器已被移除时 dispose 可能抛错，忽略即可 */
  }
  benchChart = null;
}

window.addEventListener("resize", () => benchChart && benchChart.resize());
window.addEventListener("app:before-unmount", disposeBenchChart);

Views.problem = {
  async render(root, { slug }) {
    const problem = await API.get(`/api/problems/${slug}`);

    root.innerHTML = "";

    // 题解不设门禁：详情接口直接带下来，随时可看
    const solutionData = {
      solution_code: problem.solution_code,
      solution_md: problem.solution_md,
    };

    /* 头部 */
    root.appendChild(
      h("div", { class: "page-head" }, [
        h("h1", { class: "page-title" }, [
          h("span", { class: "muted", style: "font-size:18px; margin-right:8px" },
            problem.lc ? `LC${problem.lc}` : "练习"),
          problem.title,
        ]),
        h("div", { style: "display:flex; gap:8px; flex-wrap:wrap; margin-top:8px" }, [
          diffBadge(problem.difficulty),
          ...problem.tags.map(tagBadge),
        ]),
      ])
    );

    /* Tabs */
    const panels = {
      practice: h("div"),
      solution: h("div", { style: "display:none" }),
      bench: h("div", { style: "display:none" }),
    };

    const tabDefs = [
      { key: "practice", text: "在线答题" },
      { key: "solution", text: "题解思路" },
      ...(problem.bench ? [{ key: "bench", text: "性能实测" }] : []),
    ];
    const tabEls = {};
    const tabs = h(
      "div",
      { class: "tabs" },
      tabDefs.map((def) => {
        const btn = h(
          "button",
          {
            class: `tab${def.key === "practice" ? " active" : ""}`,
            onclick: () => activate(def.key),
          },
          def.text
        );
        tabEls[def.key] = btn;
        return btn;
      })
    );

    function activate(key) {
      Object.entries(panels).forEach(([k, el]) => {
        el.style.display = k === key ? "" : "none";
      });
      Object.entries(tabEls).forEach(([k, btn]) => {
        btn.classList.toggle("active", k === key);
      });
    }

    function renderSolution() {
      panels.solution.innerHTML = "";
      panels.solution.appendChild(
        h("div", { class: "card" }, [
          h("div", { class: "card-title" }, "参考实现"),
          h("pre", {}, h("code", { class: "language-python" }, solutionData.solution_code)),
        ])
      );
      panels.solution.appendChild(h("div", { class: "card" }, mdNode(solutionData.solution_md)));
    }

    root.appendChild(tabs);
    Object.values(panels).forEach((p) => root.appendChild(p));

    buildPractice(problem, panels.practice);
    renderSolution();
    if (problem.bench) buildBench(problem, panels.bench);
  },
};

/* ---------------- 在线答题 ---------------- */

function buildPractice(problem, panel) {
  const resultBox = h("div");

  const editorHost = h("div");
  const editor = CodeMirror(editorHost, {
    value: problem.starter_code,
    mode: "python",
    lineNumbers: true,
    indentUnit: 4,
    matchBrackets: true,
    autoCloseBrackets: true,
    tabSize: 4,
  });

  const statusLine = h("span", { class: "muted" }, "Python 运行环境：待启动");
  PyRunner.onStatus((s) => {
    statusLine.textContent =
      "Python 运行环境：" +
      (s === "ready" ? "就绪" : s === "loading" ? "加载中（首次约需数秒）…" : "待启动");
  });

  const runBtn = h("button", { class: "btn primary", onclick: runJudge }, "▶ 运行判题");
  const resetBtn = h(
    "button",
    {
      class: "btn",
      onclick: () => {
        editor.setValue(problem.starter_code);
        resultBox.innerHTML = "";
      },
    },
    "重置代码"
  );

  async function runJudge() {
    runBtn.disabled = true;
    resultBox.innerHTML = "";
    resultBox.appendChild(spinner("Pyodide 执行中…"));
    try {
      const result = await PyRunner.judge(problem, editor.getValue());
      await API.post(`/api/problems/${problem.slug}/attempts`, {
        code: editor.getValue(),
        passed: result.passed,
        total: result.total,
        duration_ms: result.duration_ms,
      });
      renderJudgeResult(problem, resultBox, result);
    } catch (e) {
      resultBox.innerHTML = "";
      resultBox.appendChild(h("div", { class: "error-box" }, String(e.message || e)));
    } finally {
      runBtn.disabled = false;
    }
  }

  panel.appendChild(
    h("div", { class: "workbench" }, [
      h("div", {}, [
        h("div", { class: "card" }, mdNode(problem.body_md)),
      ]),
      h("div", { class: "card" }, [
        h("div", { class: "row-between" }, [
          h("div", { class: "card-title", style: "margin:0" }, "代码编辑器（Python）"),
          statusLine,
        ]),
        editorHost,
        h("div", { class: "editor-bar" }, [runBtn, resetBtn]),
        resultBox,
      ]),
    ])
  );
}

function renderJudgeResult(problem, box, result) {
  box.innerHTML = "";
  const allPass = result.passed === result.total;

  box.appendChild(
    h(
      "div",
      { class: `judge-summary ${allPass ? "pass" : "fail"}` },
      allPass
        ? `✓ 全部通过（${result.passed}/${result.total}）· 用例执行耗时约 ${result.duration_ms}ms`
        : `✗ 通过 ${result.passed}/${result.total} 个用例`
    )
  );

  if (allPass) {
    Toast.success("恭喜，全部用例通过！");
  }

  const errorCases = result.cases.filter((c) => c.error);
  if (errorCases.length) {
    box.appendChild(
      h("div", { class: "error-box" }, errorCases[0].error)
    );
  }

  const table = h("table", { class: "case-table" }, [
    h("thead", {}, h("tr", {}, [
      h("th", {}, "结果"),
      h("th", {}, "用例"),
      h("th", {}, "期望"),
      h("th", {}, "实际"),
    ])),
    h(
      "tbody",
      {},
      result.cases.map((c) =>
        h("tr", { class: c.ok ? "ok" : "bad" }, [
          h("td", {}, c.ok ? "✓" : "✕"),
          h("td", {}, c.desc),
          h("td", {}, h("code", {}, JSON.stringify(c.expected))),
          h("td", {}, c.error ? "运行异常" : h("code", {}, JSON.stringify(c.actual))),
        ])
      )
    ),
  ]);
  box.appendChild(table);
}

/* ---------------- 性能实测 ---------------- */

function buildBench(problem, panel) {
  disposeBenchChart();
  const chartHost = h("div", { class: "bench-chart" });
  // 两份默认解法：参考题解 + 用户自己的解法
  const entries = [
    makeEntry("参考解法", problem.solution_code),
    makeEntry("我的解法", problem.starter_code),
  ];
  const entriesHost = h("div", {}, entries.map((e) => e.wrap));

  function makeEntry(name, code) {
    const host = h("div");
    const editor = CodeMirror(host, {
      value: code,
      mode: "python",
      lineNumbers: true,
      indentUnit: 4,
      minHeight: 120,
    });
    editor.setSize(null, 150);
    const nameInput = h("input", { type: "text", value: name });
    const wrap = h("div", { class: "bench-solution" }, [
      h("div", { class: "bs-head" }, [nameInput]),
      host,
    ]);
    return { wrap, editor, nameInput };
  }

  const addBtn = h(
    "button",
    {
      class: "btn sm",
      onclick: () => {
        if (entries.length >= 4) {
          Toast.info("最多对比 4 份解法");
          return;
        }
        const entry = makeEntry(`解法 ${entries.length + 1}`, problem.starter_code);
        entries.push(entry);
        entriesHost.appendChild(entry.wrap);
      },
    },
    "+ 增加解法"
  );

  const runBtn = h("button", { class: "btn primary", onclick: runBench }, "▶ 开始实测");

  async function runBench() {
    const solutions = entries
      .map((e) => ({ name: e.nameInput.value || "未命名", code: e.editor.getValue() }))
      .filter((s) => s.code.trim());
    if (!solutions.length) {
      Toast.info("至少写一份解法再实测");
      return;
    }
    runBtn.disabled = true;
    try {
      const rows = await PyRunner.bench(problem, solutions);
      const errorRows = rows.filter((r) => r.error);
      if (errorRows.length) {
        Toast.error("部分解法运行失败，请检查代码");
      }
      renderBenchChart(rows, problem.bench.scales);
      await API.post("/api/bench", {
        results: rows.map((r) => ({ ...r, problem_slug: problem.slug })),
      });
    } catch (e) {
      Toast.error(String(e.message || e));
    } finally {
      runBtn.disabled = false;
    }
  }

  function renderBenchChart(rows, scales) {
    const names = [...new Set(rows.filter((r) => !r.error).map((r) => r.name))];
    const series = names.map((name) => ({
      name,
      type: "line",
      smooth: true,
      symbolSize: 7,
      data: scales.map((n) => {
        const hit = rows.find((r) => r.name === name && r.n === n);
        return hit ? Number(hit.ms.toFixed(3)) : null;
      }),
    }));

    if (!benchChart) benchChart = echarts.init(chartHost);
    benchChart.setOption({
      tooltip: { trigger: "axis", valueFormatter: (v) => v + " ms" },
      legend: { top: 0 },
      grid: { left: 60, right: 24, top: 44, bottom: 40 },
      xAxis: {
        type: "category",
        name: "输入规模 n",
        data: scales,
      },
      yAxis: { type: "value", name: "耗时 (ms)" },
      series,
    }, true);
  }

  panel.appendChild(
    h("div", { class: "card" }, [
      h("div", { class: "card-title" }, "多解法性能对比"),
      h("p", { class: "muted", style: "margin-top:0" },
        `在同一组随机输入上运行各解法，单次计时存在噪声，关注随 n 增长的趋势。规模档：${problem.bench.scales.join(" / ")}`),
      entriesHost,
      h("div", { class: "editor-bar" }, [runBtn, addBtn]),
    ])
  );
  panel.appendChild(h("div", { class: "card" }, [chartHost]));
}
