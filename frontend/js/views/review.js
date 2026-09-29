/* 错题本：最近判错且未重新通过的题目。 */
Views.review = {
  async render(root) {
    const data = await API.get("/api/review/wrong");

    root.innerHTML = "";
    root.appendChild(
      h("div", { class: "page-head" }, [
        h("h1", { class: "page-title" }, "错题本"),
        h("p", { class: "page-desc" }, "判错的题会自动收录；重新判题通过或手动标记「我会了」即移出。"),
      ])
    );

    if (!data.items.length) {
      root.appendChild(
        h("div", { class: "card" }, [
          h("div", { class: "empty" }, [
            h("span", { class: "em-icon" }, "🎯"),
            "还没有错题，去答题页挑战一下吧",
          ]),
        ])
      );
      return;
    }

    root.appendChild(
      h(
        "div",
        { class: "card" },
        data.items.map((item) => {
          const resolveBtn = h(
            "button",
            { class: "btn sm", onclick: onResolve },
            "我会了"
          );

          async function onResolve() {
            resolveBtn.disabled = true;
            await API.post(`/api/review/${item.slug}/resolve`);
            Toast.success("已移出错题本");
            wrap.style.opacity = "0.4";
            resolveBtn.textContent = "✓ 已移除";
          }

          const wrap = h("div", { class: "row-between", style: "padding:12px 0; border-bottom:1px solid var(--c-border)" }, [
            h("span", {}, [
              h("span", { class: "muted", style: "margin-right:8px" },
                item.lc ? `LC${item.lc}` : "练习"),
              h("a", { href: `#/problem/${item.slug}` }, item.title),
            ]),
            h("span", { style: "display:flex; gap:8px; align-items:center" }, [
              diffBadge(item.difficulty),
              h("span", { class: "badge fail" }, `错过 ${item.fail_count} 次`),
              h("a", { class: "btn sm primary", href: `#/problem/${item.slug}` }, "去攻克"),
              resolveBtn,
            ]),
          ]);
          return wrap;
        })
      )
    );
  },
};
