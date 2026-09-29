/* 播放器渲染层 DOM 测试（Node + 最小 DOM stub，不依赖浏览器）。
 *
 * 覆盖新动效渲染层的关键行为：
 *   1. 入场错峰：build 后柱子从 0 高度弹入，约 1.2s 后全部到位
 *   2. 浮点插值：交换过渡中，柱子的 x 位于两个槽位之间、y 有弧线抬升（不再是硬切）
 *   3. 完成庆祝：播放到头后绿浪扫过（柱色混白），完成徽章出现
 *   4. 音效开关：默认静音，点击后切换状态（无 AudioContext 环境下不炸）
 *   5. 赛跑模式：双轨道播放到结束不抛异常
 *
 * 运行：node tests/check_player_dom.mjs
 */

/* DOM stub 与时钟抽到了 tests/dom_stub.mjs（场景渲染测试共用同一份，
 * 避免两份 stub 漂移导致"渲染坏了测试还绿"）。 */
import {
  installDomStub, pumpFrames, pendingFrame, lastAudioContext,
  setAudioContext, getAudioContext, FakeNode, clock, createChecker,
} from "./dom_stub.mjs";

installDomStub();

const { mountPlayer } = await import("../frontend/js/anim/player.js");
const { buildStepsFor } = await import("../frontend/js/anim/sorts.js");
const { INPUT_PRESETS, roleOf, buildStates } = await import("../frontend/js/anim/protocol.js");
const { THEME, barColor } = await import("../frontend/js/anim/theme.js");

/* ---------------- 断言工具 ---------------- */

const { ok, section, finish } = createChecker();

/* SVG 子节点定位：bg 之后每槽 3 个节点（slot、bar、label），最后是 chip。 */
function barOf(svg, i) { return svg.children[1 + i * 3 + 1]; }

const N = 8;
const SLOT = (800 - 40) / N;
const BAR_W = Math.max(6, SLOT * 0.66);
const slotX = (i) => 20 + SLOT * i + SLOT / 2;

/* ---------------- 1. 单算法播放器：入场 → 插值 → 完成 ---------------- */

section("sort-bubble：入场错峰与交换插值");

clock.now = 1000;
const host = new FakeNode("div");
const player = mountPlayer(host, "sort-bubble");
const root = host.children[0];
const svg = root.querySelector ? null : null; // FakeNode 不实现 querySelector，直接用结构定位
const tracksHost = root.children[0];
const trackWrap = tracksHost.children[0];
const trackSvg = trackWrap.children[trackWrap.children.length - 1].children[0];

ok(pendingFrame() !== null, "build 后入场动效启动了 rAF 循环");
ok(barOf(trackSvg, 0).getAttribute("opacity") === "0", "入场起点：第 1 根柱子高度为 0（opacity 0）");

pumpFrames(30, 50); // 推进 1.5s，入场（(8-1)*40+380=660ms）必定结束
ok(barOf(trackSvg, 0).getAttribute("opacity") !== "0", "入场结束后第 1 根柱子可见");

const input = [...INPUT_PRESETS.random.values];
const steps = buildStepsFor("bubble", input);
const swapIdx = steps.findIndex((s) => s.op === "swap");
ok(swapIdx > 0, `冒泡在随机输入上存在交换步（第 ${swapIdx} 步）`);
const swapStep = steps[swapIdx];

// budget 从 0 起播，每帧 +0.2 步（50ms × 4步/s），泵到交换过渡中段
player.play();
let frames = 0;
while (frames * 0.2 < swapIdx + 0.45) { pumpFrames(1); frames++; }
// 此刻 budget ≈ swapIdx + 0.4~0.6，正处交换插值中段
const midBar = barOf(trackSvg, swapStep.i);
const x = parseFloat(midBar.getAttribute("x"));
const lo = Math.min(slotX(swapStep.i), slotX(swapStep.j)) - BAR_W / 2;
const hi = Math.max(slotX(swapStep.i), slotX(swapStep.j)) - BAR_W / 2;
ok(x > lo + 2 && x < hi - 2, `交换中段柱子 x=${x.toFixed(1)} 位于两槽位之间（${lo.toFixed(1)} ~ ${hi.toFixed(1)}），是滑动不是瞬移`);

const states = buildStates(input, steps);
const movingValue = states[swapIdx].array[swapStep.j]; // 槽 i 渲染的是来自 j 的值
const expectedH = Math.max(6, (movingValue / Math.max(...input)) * 220);
const staticY = 254 - expectedH;
const y = parseFloat(midBar.getAttribute("y"));
ok(y < staticY - 1, `交换中段柱子有弧线抬升：y=${y.toFixed(1)} < 静止位 ${staticY.toFixed(1)}`);
ok(midBar.getAttribute("stroke") !== "none", "运动中的柱子带白色描边高光");

section("sort-bubble：播放到完成的绿浪与徽章");

const controls = root.children[1];
const badge = trackWrap.children[0].children[2].children[0];
// 先泵到播放结束（完成徽章出现），绿浪从这一刻开始
let guard2 = 0;
while (pendingFrame() && badge.style.display === "none" && guard2 < 2000) { pumpFrames(1); guard2++; }
ok(badge.style.display === "", "完成后「完成」徽章可见");

// 绿浪窗口（0.85s）内逐帧采样柱色，应捕到混白闪光
const finalRole = roleOf(states[states.length - 1], 0);
const baseFill = barColor(finalRole).toLowerCase();
let sawWave = false;
for (let k = 0; k < 20 && pendingFrame(); k++) {
  pumpFrames(1, 60);
  const fill = (barOf(trackSvg, 0).getAttribute("fill") || "").toLowerCase();
  if (fill && fill !== baseFill) { sawWave = true; break; }
}
ok(sawWave, "完成绿浪扫过：柱色短暂混白后恢复");

section("音效开关");

const soundBtn = controls.children.find((c) => c.classList.contains("anim-sound"));
ok(!!soundBtn, "控制栏存在音效按钮");
ok(soundBtn.classList.contains("off"), "音效默认关闭（静音）");
soundBtn.click();
ok(!soundBtn.classList.contains("off"), "点击后音效开启");
soundBtn.click();
ok(soundBtn.classList.contains("off"), "再次点击恢复静音");

player.destroy();

/* ---------------- 回归：音频子系统抛错绝不能拖垮播放 ----------------
 * 用户实测 bug：AudioContext 被环境拦截后，异常杀死 rAF 循环，
 * 表现为"点播放不动、只能手拖、也没声音"。 */

section("回归：音频抛错不拖垮播放（用户实测 bug）");

const freshAudio = await import("../frontend/js/anim/audio.js?fresh=1");
const RealAC = getAudioContext();
setAudioContext(class { constructor() { throw new Error("denied by policy"); } });
freshAudio.setSoundEnabled(true);
ok(freshAudio.soundEnabled() === false, "AudioContext 构造抛错时开关自动保持关闭（不虚假开启）");
setAudioContext(RealAC);

// 播放途中每个音都抛错：播放必须照常推进
lastAudioContext().createOscillator = () => { throw new Error("oscillator denied"); };
clock.now = 20000;
const host3 = new FakeNode("div");
const player3 = mountPlayer(host3, "sort-bubble");
const root3 = host3.children[0];
const controls3 = root3.children[1];
const stepLabel3 = controls3.children[4];
const soundBtn3 = controls3.children.find((c) => c.classList.contains("anim-sound"));
soundBtn3.click();   // ctx 已存在，开关能开；但每个音都会在 tone 内部抛错（被兜底）
ok(!soundBtn3.classList.contains("off"), "已有 AudioContext 时音效开关可开启");
player3.play();
pumpFrames(8);   // 首帧 dt=0，之后每帧 +0.2 步 → budget≈1.4，跨过步 1（该步音效必抛错）
ok(/步 [1-9]/.test(stepLabel3.textContent), `音频逐帧抛错下播放照常推进（${stepLabel3.textContent}）`);
player3.destroy();

/* ---------------- 2. 赛跑模式：双轨道播完不炸 ---------------- */

section("race-bubble-quick：双轨道完整播放");

clock.now = 10000;
const raceHost = new FakeNode("div");
const racePlayer = mountPlayer(raceHost, "race-bubble-quick");
const raceRoot = raceHost.children[0];
const raceTracks = raceRoot.children[0];
ok(raceTracks.children.length === 2, "赛跑有两条轨道");
racePlayer.play();
let guard = 0;
while (pendingFrame() && guard < 2000) { pumpFrames(1, 50); guard++; }
ok(guard < 2000, `赛跑在有限帧内播完并停住（用了 ${guard} 帧）`);
const raceNote = raceRoot.children[2].textContent;
ok(/步|快|同时/.test(raceNote), `赛跑结论文案已生成：「${raceNote.slice(0, 40)}…」`);
racePlayer.destroy();

/* ---------------- 汇总 ---------------- */

finish();
