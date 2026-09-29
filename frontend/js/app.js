/* Hash 路由与应用壳层。
 * 约定：每个视图是 { async render(root, params) }，挂载在全局 Views 上。
 */
const Router = (() => {
  const root = document.getElementById("app");

  // 路由表：hash 段 → [视图名, 参数解析]
  const ROUTES = [
    { match: /^$|^home$/, view: "home" },
    { match: /^ds$/, view: "catalog", params: { category: "data-structure" } },
    { match: /^algo$/, view: "catalog", params: { category: "algorithm" } },
    { match: /^anim$/, view: "anim" },
    { match: /^anim\/(.+)$/, view: "animRoom", groups: ["key"] },
    { match: /^review$/, view: "review" },
    { match: /^topic\/(.+)$/, view: "topic", groups: ["slug"] },
    { match: /^problem\/(.+)$/, view: "problem", groups: ["slug"] },
  ];

  function parse() {
    const hash = location.hash.replace(/^#\/?/, "");
    for (const route of ROUTES) {
      const m = hash.match(route.match);
      if (m) {
        const params = { ...(route.params || {}) };
        (route.groups || []).forEach((name, i) => (params[name] = m[i + 1]));
        return { view: route.view, params };
      }
    }
    return { view: "home", params: {} };
  }

  function setActiveNav(name) {
    document.querySelectorAll(".mainnav a").forEach((a) => {
      a.classList.toggle("active", a.dataset.route === name);
    });
  }

  let current = null;

  async function render() {
    const { view, params } = parse();
    const handler = Views[view];
    if (!handler) {
      root.innerHTML = '<div class="empty">页面不存在</div>';
      return;
    }

    // 同视图且定位参数未变时不重复挂载（保留编辑器状态）。
    // catalog 没有 slug，用 category 区分（否则 ds↔algo 会被误判为同一页）；
    // 动画大屏的定位参数是 key。
    const sig = view + ":" + (params.slug || params.key || params.category || "");
    if (sig === current) return;
    current = sig;

    // 离开旧视图：给需要释放资源（图表、定时器、动画播放）的视图一个清理点
    window.dispatchEvent(new CustomEvent("app:before-unmount"));

    setActiveNav(
      view === "catalog"
        ? (params.category === "algorithm" ? "algo" : "ds")
        : view.startsWith("anim")
        ? "anim"
        : view
    );
    window.scrollTo(0, 0);
    root.innerHTML = "";
    root.appendChild(spinner());
    try {
      await handler.render(root, params);
    } catch (e) {
      if (e && e.status) {
        root.innerHTML = '<div class="empty"><span class="em-icon">⚠️</span>内容加载失败</div>';
      } else {
        console.error(e);
        root.innerHTML = '<div class="empty"><span class="em-icon">💥</span>页面渲染异常</div>';
      }
    }
  }

  function invalidate() {
    current = null;
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("DOMContentLoaded", render);

  return { render, invalidate };
})();
