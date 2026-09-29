/* 大类目录页：数据结构 / 算法 下的全部知识点。 */
Views.catalog = {
  async render(root, params) {
    const [catalog, progressMap] = await Promise.all([
      API.get("/api/catalog"),
      API.get("/api/progress/topics"),
    ]);
    const category = catalog.categories.find((c) => c.key === params.category);
    const learnedSet = new Set(
      progressMap.items.filter((i) => i.learned).map((i) => i.topic_slug)
    );

    root.innerHTML = "";
    root.appendChild(
      h("div", { class: "page-head" }, [
        h("h1", { class: "page-title" }, category.title),
        h("p", { class: "page-desc" }, category.desc),
      ])
    );

    root.appendChild(
      h(
        "div",
        { class: "grid cols-2" },
        category.topics.map((topic) => {
          const learned = learnedSet.has(topic.slug);
          const anims = window.AnimPlayer ? window.AnimPlayer.list(topic.slug) : [];
          return h("a", { class: "entry-card", href: `#/topic/${topic.slug}` }, [
            h("div", { class: "ec-title" }, [
              learned ? h("span", { title: "已学", style: "color:var(--c-success)" }, "✓") : null,
              topic.title,
            ]),
            h("div", { class: "ec-sub" }, topic.subtitle),
            h("div", { class: "ec-foot" }, [
              diffBadge(topic.difficulty),
              ...topic.tags.slice(0, 3).map(tagBadge),
              ...(anims.length
                ? [h("span", { class: "badge primary" }, `动画 ${anims.length}`)]
                : []),
            ]),
          ]);
        })
      )
    );
  },
};
