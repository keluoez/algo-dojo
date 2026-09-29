/* 音效引擎：Sound of Sorting 风格 —— 被操作的值映射成音高。
 *
 * 这是算法可视化最出圈的特征（Timo Bingmann《15 Sorting Algorithms in 6 Minutes》
 * 的核心手法）：比较的两个值 → 两个短促的三角波音，排序完成 → 上升琶音。
 * 纯 WebAudio 合成，零音频资源、零依赖；默认关闭，用户点喇叭后才创建 AudioContext
 * （浏览器自动播放策略要求首次出声必须在用户手势之后）。
 *
 * 健壮性铁律：音效只是增强体验。任何环境下（嵌入 webview 禁用音频、
 * AudioContext 被权限策略拦截、振荡器创建失败）都绝不允许影响播放 ——
 * 所有可能抛错的地方都有 try/catch 兜底，创建失败时开关自动保持关闭。
 */

let ctx = null;
let master = null;
let enabled = false;
let lastArpeggioAt = 0;

const FREQ_MIN = 150;    // Hz，最小值对应的音高
const FREQ_MAX = 1150;   // Hz，最大值对应的音高

/* 返回可用的 AudioContext；环境不支持 / 被策略拦截时返回 null（不抛出）。 */
function ensureCtx() {
  if (ctx) {
    if (ctx.state === "suspended") { try { ctx.resume(); } catch { /* 忽略 */ } }
    return ctx;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.16;   // 总音量压低，高频三角波才不会刺耳
    master.connect(ctx.destination);
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    ctx = null;
    master = null;
    return null;
  }
}

export function setSoundEnabled(on) {
  enabled = !!on;
  // 环境不支持音频时保持关闭（按钮也相应保持"关"态，不做虚假开启）
  if (enabled && !ensureCtx()) enabled = false;
}

export function soundEnabled() {
  return enabled;
}

/* 值 → 频率：线性映射到 [FREQ_MIN, FREQ_MAX]，值越大音越高。 */
export function freqOf(value, maxValue) {
  const v = Math.max(0, Number(value) || 0);
  return FREQ_MIN + (v / Math.max(1, maxValue)) * (FREQ_MAX - FREQ_MIN);
}

/* 单个音：快速起音 + 指数衰减，短促干净。when 是相对现在的秒数（用于连音）。 */
export function tone(freq, { dur = 0.05, when = 0, vol = 0.9, type = "triangle" } = {}) {
  if (!enabled || !Number.isFinite(freq)) return;
  const c = ensureCtx();
  if (!c) return;
  try {
    const t0 = c.currentTime + Math.max(0, when);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.linearRampToValueAtTime(vol, t0 + 0.008);
    gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    /* 单个音失败无碍大局，绝不向上抛 */
  }
}

/* 开启音效时的确认音：让用户立刻知道音频是否真的出声。
 * 听不到这声 = 环境禁了音频（如嵌入 webview），不是播放逻辑的问题。 */
export function confirmTone() {
  tone(660, { dur: 0.09, vol: 0.9 });
  tone(880, { dur: 0.11, when: 0.1, vol: 0.9 });
}

/* 进入一个新 step 时的配音。stateBefore 是执行该 step 之前的状态。 */
export function stepSound(step, stateBefore, maxValue) {
  if (!enabled || !step || !stateBefore) return;
  try {
    const f = (v) => freqOf(v, maxValue);
    switch (step.op) {
      case "compare": {
        const vi = stateBefore.array[step.i];
        const vj = step.j === null || step.j === undefined ? stateBefore.held : stateBefore.array[step.j];
        if (vi !== null && vi !== undefined) tone(f(vi), { dur: 0.045 });
        if (vj !== null && vj !== undefined) tone(f(vj), { dur: 0.045, when: 0.012, vol: 0.65 });
        break;
      }
      case "swap":
        tone(f(stateBefore.array[step.i]), { dur: 0.06 });
        tone(f(stateBefore.array[step.j]), { dur: 0.06, when: 0.03 });
        break;
      case "shift":
        tone(f(stateBefore.array[step.from]), { dur: 0.05 });
        break;
      case "set":
        tone(f(step.value), { dur: 0.07, vol: 1 });
        break;
      case "setRange":
        tone(f(step.values[Math.floor(step.values.length / 2)]), { dur: 0.06, vol: 0.8 });
        break;
      case "hole":
        tone(f(stateBefore.array[step.i]), { dur: 0.05, vol: 0.8 });
        break;
      case "mark":
        if (step.kind === "sorted") tone(1320, { dur: 0.04, vol: 0.4, type: "sine" });
        break;
      default:
        break;
    }
  } catch {
    /* 音效异常不影响播放 */
  }
}

/* 排序完成琶音：已升序的数组从左到右依次发声，音高自然上行。 */
export function arpeggio(sortedValues, maxValue) {
  if (!enabled) return;
  try {
    const now = performance.now();
    if (now - lastArpeggioAt < 600) return;   // 赛跑两条轨道同时完成时不叠着炸
    lastArpeggioAt = now;
    sortedValues.forEach((v, i) => {
      tone(freqOf(v, maxValue), { dur: 0.09, when: i * 0.055, vol: 0.8 });
    });
  } catch {
    /* 音效异常不影响播放 */
  }
}
