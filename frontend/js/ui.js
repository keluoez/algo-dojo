/* DOM 与通用 UI 辅助：hyperscript、Toast、Markdown 渲染、徽章。
 * 全视图共用，避免到处拼 innerHTML。
 */

/* 视图注册表：views/*.js 向其挂载 { render }，app.js 路由时读取。
 * 必须在视图脚本之前初始化，否则首次赋值即 ReferenceError。
 */
window.Views = {};

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "html") el.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      el.setAttribute(key, "");
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    if (child instanceof Node) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  }
  return el;
}

const DIFF_LABEL = ["", "简单", "中等", "困难"];

function diffBadge(level) {
  return h("span", { class: `badge diff-${level}` }, DIFF_LABEL[level] || "未知");
}

function tagBadge(text) {
  return h("span", { class: "badge ghost" }, text);
}

/* Markdown：marked 已在 vendor 提供 */
marked.setOptions({ breaks: false, gfm: true });

function mdToHtml(markdown) {
  return marked.parse(markdown || "");
}

function mdNode(markdown) {
  return h("div", { class: "md-body", html: mdToHtml(markdown) });
}

/* ---------------- Toast ---------------- */

const Toast = (() => {
  const TYPES = {
    success: { cls: "ok", icon: "✓" },
    error: { cls: "fail", icon: "✕" },
    info: { cls: "primary", icon: "ℹ" },
  };

  function show(message, type = "info", duration = 2600) {
    const stack = document.getElementById("toast-stack");
    const conf = TYPES[type] || TYPES.info;
    const item = h(
      "div",
      { class: `toast toast-${conf.cls}` },
      [h("span", { class: "toast-icon" }, conf.icon), h("span", {}, message)]
    );
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => {
      item.classList.remove("show");
      setTimeout(() => item.remove(), 250);
    }, duration);
  }

  return {
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error", 3600),
    info: (m) => show(m, "info"),
  };
})();

function spinner(text = "加载中…") {
  return h("div", { class: "loading-note" }, text);
}
