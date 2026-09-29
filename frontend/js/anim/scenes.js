/* 场景动画的总入口：把 Agent 实战场景与经典算法场景合成一份目录。
 *
 * 为什么要这一层：场景动画一开始只有 Agent 那 6 个（agents.js），
 * 后来经典算法（二分 / 双指针 / 链表…）也走场景视图。
 * 如果让 registry / player / 测试各处分别 import agents.js 和 classics.js，
 * 每加一类就要改三个地方。这里统一出口，新增一类只改这一处。
 */
import {
  AGENT_BUILDERS, AGENT_INPUTS, AGENTS,
} from "./agents.js?v=16";
import {
  CLASSIC_BUILDERS, CLASSIC_INPUTS, CLASSICS, CLASSIC_GROUPS,
} from "./classics.js?v=16";

export const SCENE_BUILDERS = { ...AGENT_BUILDERS, ...CLASSIC_BUILDERS };
export const SCENE_INPUTS = { ...AGENT_INPUTS, ...CLASSIC_INPUTS };
export const SCENES = { ...AGENTS, ...CLASSICS };

/* 分组：动画中心按组分小节。Agent 场景归在 agent 组。 */
export const SCENE_GROUPS = {
  sort: "排序（非比较型）",
  pointer: "指针、窗口与贪心",
  list: "链表",
  agent: "Agent 实战场景",
  ...CLASSIC_GROUPS,
};

/** Agent 场景的元信息里没有 group，补上 */
Object.keys(AGENTS).forEach((k) => {
  SCENES[k] = { ...SCENES[k], group: "agent" };
});

export function buildSceneSteps(kind, input) {
  const fn = SCENE_BUILDERS[kind];
  if (!fn) throw new Error(`未知场景动画: ${kind}`);
  return fn(input || SCENE_INPUTS[kind]);
}

export { AGENT_BUILDERS, AGENT_INPUTS, AGENTS };
export { CLASSIC_BUILDERS, CLASSIC_INPUTS, CLASSICS, CLASSIC_GROUPS };
