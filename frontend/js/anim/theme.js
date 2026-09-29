/* 动画视觉主题：视频专用深色高对比。
 *
 * 浏览器播放器与 Remotion 成片共用这一份配色，保证"互动看的"和"导出的"
 * 是同一套视觉语言。深底色 + 高饱和柱体，投影到 1080p 大屏也清晰。
 */
export const THEME = {
  bg: "#0B1020",          // 舞台底色
  panel: "#131A2E",       // 面板
  grid: "#22304D",        // 网格线 / 分隔
  text: "#E6ECF5",        // 主文字
  muted: "#93A4BF",       // 次要文字
  accent: "#4C8DFF",      // 强调（标题装饰 / 进度条）

  bar: "#3E5C9A",         // 柱体默认（未处理）
  barText: "#C9D6EF",     // 柱体数值文字
  comparing: "#FBBF24",   // 正在比较
  swapping: "#F472B6",    // 正在交换
  written: "#22D3EE",     // 正在写入（归并 / 插入）
  sorted: "#34D399",      // 已就位
  pivot: "#C084FC",       // 基准 / 轴
  key: "#FB923C",         // 手里暂存的元素（插入排序的 key）
  hole: "#2A3A5C",        // 空位（元素被取出暂存）
  dim: "#1B2540",         // 区间外的暗化柱体
};

/* 柱体配色优先级：空位 > 比较 > 交换 > 写入 > 基准/暂存 > 已就位 > 默认 */
export function barColor(role) {
  switch (role) {
    case "hole": return THEME.hole;
    case "comparing": return THEME.comparing;
    case "swapping": return THEME.swapping;
    case "written": return THEME.written;
    case "pivot": return THEME.pivot;
    case "key": return THEME.key;
    case "sorted": return THEME.sorted;
    case "dim": return THEME.dim;
    default: return THEME.bar;
  }
}
