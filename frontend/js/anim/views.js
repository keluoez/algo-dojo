/* 动画相关视图：动画中心（#/anim）与单个动画大屏（#/anim/{key}）。
 *
 * 以 ES 模块加载（Remotion 侧要 import 同一份算法层），但视图仍按项目约定
 * 注册到全局 Views 上，这样经典脚本写的路由不用改。
 */
import { ANIMATIONS, getAnimation, listAnimations, sceneGroups } from "./registry.js?v=16";
import { mountInto } from "./player.js?v=16";
import { SORTS } from "./sorts.js?v=16";
import { SCENES } from "./scenes.js?v=16";

window.Views = window.Views || {};

/* 供经典脚本（知识点页 / 目录页）复用 */
window.AnimPlayer = { mountInto, list: listAnimations, get: getAnimation, sorts: SORTS };

const h = (...args) => window.h(...args);

function animCard(anim) {
  const isScene = anim.view === "scene";
  const algos = anim.mode === "race" ? [anim.left, anim.right] : [anim.algo];
  const foot = isScene
    ? [
      h("span", { class: "badge primary" }, SCENES[anim.kind].badge),
      h("span", { class: "badge ghost" }, SCENES[anim.kind].time),
      // 有些动画（比如盛水双指针）内容里暂时没有对应题目，就别挂空链接
      anim.problem ? h("span", { class: "badge ghost" }, "配套题目") : null,
    ]
    : [
      ...algos.map((k) => h("span", { class: "badge ghost" }, SORTS[k].time)),
      h("span", { class: "badge ghost" }, SORTS[algos[0]].stable ? "稳定" : "不稳定"),
    ];
  return h("a", { class: "entry-card anim-entry", href: `#/anim/${anim.key}` }, [
    h("div", { class: "ec-title" }, [
      anim.title,
      anim.mode === "race" ? h("span", { class: "badge primary" }, "赛跑") : null,
    ]),
    h("div", { class: "ec-sub" }, anim.subtitle),
    h("div", { class: "ec-foot" }, foot),
  ]);
}

window.Views.anim = {
  async render(root) {
    root.innerHTML = "";
    root.appendChild(
      h("div", { class: "page-head" }, [
        h("h1", { class: "page-title" }, "算法动画"),
        h("p", { class: "page-desc" }, "看得见的算法：单步、调速、回退，或者让两个算法同场赛跑。"),
      ])
    );

    const singles = ANIMATIONS.filter((a) => a.mode === "single" && a.view !== "scene");
    const races = ANIMATIONS.filter((a) => a.mode === "race");
    const groups = sceneGroups();

    root.appendChild(
      h("div", { class: "card" }, [
        h("div", { class: "card-title" }, "单个算法"),
        h("p", { class: "muted", style: "margin-top:0" },
          "底部可切换输入（随机 / 近乎有序 / 完全逆序 / 少量重复）——同一个算法换个输入，干活量完全不同。"),
        h("div", { class: "grid cols-2" }, singles.map(animCard)),
      ])
    );

    root.appendChild(
      h("div", { class: "card mt-16" }, [
        h("div", { class: "card-title" }, "同场赛跑"),
        h("p", { class: "muted", style: "margin-top:0" },
          "同一组输入、同一个节奏推进，直接看谁先排完、谁多做了多少比较。"),
        h("div", { class: "grid cols-2" }, races.map(animCard)),
      ])
    );

    /* 场景动画按 group 分小节：排序 / 指针与窗口 / 链表 / Agent 实战。
     * 一开始只有 Agent 那六个，后来经典算法也走场景视图，
     * 再挤在一节里就分不清"哪个是排序、哪个是检索"了。 */
    const GROUP_DESC = {
      sort: "不靠比较的排序：数一数就知道每个元素该去哪。",
      pointer: "二分、双指针、滑窗、贪心 —— 这类题的共同点是「别暴力枚举，先想清楚指针怎么动」。",
      list: "链表的题几乎都是指针题：掉头、追及、合并。",
      agent: "做 Agent 应用天天在用的算法点：向量检索、多路召回、上下文裁剪、工具路由、工作流编排、结果去重。每个都对应一道实战题。",
    };
    groups.forEach((g) => {
      root.appendChild(
        h("div", { class: "card mt-16" }, [
          h("div", { class: "card-title" }, g.label),
          h("p", { class: "muted", style: "margin-top:0" }, GROUP_DESC[g.group] || ""),
          h("div", { class: "grid cols-2" }, g.items.map(animCard)),
        ])
      );
    });
  },
};

window.Views.animRoom = {
  async render(root, { key }) {
    const anim = getAnimation(key);
    if (!anim) {
      root.innerHTML = '<div class="empty">动画不存在</div>';
      return;
    }
    root.innerHTML = "";

    root.appendChild(
      h("div", { class: "page-head" }, [
        h("h1", { class: "page-title" }, anim.title),
        h("p", { class: "page-desc" }, anim.subtitle),
        h("div", { style: "margin-top:10px; display:flex; gap:8px; flex-wrap:wrap" }, [
          anim.mode === "race" ? h("span", { class: "badge primary" }, "赛跑对比") : null,
          anim.view === "scene" ? h("span", { class: "badge primary" }, SCENES[anim.kind].badge) : null,
          h("a", { class: "badge ghost", href: "#/anim" }, "← 返回动画中心"),
          h("a", { class: "badge ghost", href: `#/topic/${anim.topics[0]}` },
            `配套知识点：${anim.topics[0]}`),
          anim.problem ? h("a", { class: "badge ghost", href: `#/problem/${anim.problem}` }, "配套题目 →") : null,
        ]),
      ])
    );

    /* 播放器 */
    const playerHost = h("div", { class: "anim-player-host" });
    root.appendChild(playerHost);

    /* 参数与结论 */
    if (anim.view === "scene") {
      const meta = SCENES[anim.kind];
      root.appendChild(
        h("div", { class: "card mt-16" }, [
          h("div", { class: "card-title" }, "算法要点"),
          h("table", { class: "case-table" }, [
            h("tbody", {}, [
              h("tr", {}, [h("td", {}, "一句话"), h("td", {}, meta.oneLine)]),
              h("tr", {}, [h("td", {}, "时间复杂度"), h("td", {}, meta.time)]),
              h("tr", {}, [h("td", {}, "空间复杂度"), h("td", {}, meta.space)]),
              meta.problem
                ? h("tr", {}, [h("td", {}, "配套题目"),
                  h("td", {}, h("a", { href: `#/problem/${meta.problem}` }, meta.problem))])
                : null,
            ]),
          ]),
        ])
      );
    } else {
      const algos = anim.mode === "race" ? [anim.left, anim.right] : [anim.algo];
      root.appendChild(
      h("div", { class: "card mt-16" }, [
        h("div", { class: "card-title" }, "复杂度与特性"),
        h("table", { class: "case-table" }, [
          h("thead", {}, h("tr", {}, [
            h("th", {}, "算法"), h("th", {}, "平均时间"), h("th", {}, "最好 / 最坏"),
            h("th", {}, "额外空间"), h("th", {}, "稳定性"),
          ])),
          h("tbody", {}, algos.map((k) => {
            const meta = SORTS[k];
            return h("tr", {}, [
              h("td", {}, meta.title),
              h("td", {}, meta.time),
              h("td", {}, meta.timeBest),
              h("td", {}, meta.space),
              h("td", {}, meta.stable ? "稳定" : "不稳定"),
            ]);
          })),
        ]),
        h("p", { class: "muted", style: "margin-bottom:0" },
          algos.map((k) => `${SORTS[k].title}：${SORTS[k].oneLine}`).join(" ｜ ")),
        ])
      );
    }

    /* 成片（由 Remotion 渲染，未渲染时自动隐藏） */
    if (anim.video) {
      root.appendChild(
        h("div", { class: "card mt-16" }, [
          h("div", { class: "card-title" }, "成片（Remotion 渲染）"),
          h("video", {
            class: "anim-video", src: anim.video, controls: true,
            preload: "metadata", playsinline: true,
          }),
        ])
      );
    }

    const practice = anim.view === "scene" && anim.problem
      ? [h("a", { class: "badge ghost", href: `#/problem/${anim.problem}` },
        `${anim.title}（配套题目）`)]
      : [
        h("a", { class: "badge ghost", href: "#/problem/p-lc912" }, "LC912 排序数组"),
        h("a", { class: "badge ghost", href: "#/problem/p-lc215" }, "LC215 数组中的第 K 个最大元素"),
        h("a", { class: "badge ghost", href: "#/problem/p-lcof51" }, "LC 面试题51 数组中的逆序对"),
      ];
    root.appendChild(
      h("div", { class: "card mt-16" }, [
        h("div", { class: "card-title" }, "看完去练"),
        h("div", { style: "display:flex; gap:10px; flex-wrap:wrap" }, practice),
      ])
    );

    mountInto(playerHost, anim.key);
  },
};
