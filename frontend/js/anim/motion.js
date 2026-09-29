/* 动效数学：播放器与场景渲染器共用（Remotion 侧也会 import 同一份）。
 *
 * 全部是纯函数：输入 t（0~1 的过渡进度），输出位置/颜色/尺寸。
 * 与 Remotion 的 spring()/interpolate() 语义一致，成片可直接换实现。
 */

export function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* 克制型弹簧：约 4% 过冲后收敛，用于写入生长 / 入场弹入。 */
export function springSoft(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.exp(-7 * t) * Math.cos(6 * t);
}

/* 两个 #RRGGBB 颜色按 t 混合（完成波浪的白色闪光用）。 */
export function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((k) => parseInt(a.slice(k, k + 2), 16));
  const pb = [1, 3, 5].map((k) => parseInt(b.slice(k, k + 2), 16));
  const pc = pa.map((v, k) => Math.round(v + (pb[k] - v) * clamp01(t)));
  return `#${pc.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
