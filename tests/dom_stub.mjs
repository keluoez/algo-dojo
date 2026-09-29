/* 最小 DOM stub：让动画渲染层能在 Node 里跑起来（不需要真浏览器）。
 *
 * 为什么两个测试要共用一份：播放器断言高度依赖节点结构与时钟行为，
 * 各写一份必然漂移（比如一边补了 createTextNode 另一边没补），
 * 于是"渲染层明明坏了但测试还绿"。这里集中维护，测试只管写断言。
 *
 * 用法：先 installDomStub()，再动态 import 前端模块
 * （ES import 会被提升，静态 import 会赶在 stub 装好之前执行）。
 */

/* 可控时钟：performance.now 与 rAF 共用，测试完全确定、不受真实时间影响 */
export const clock = { now: 0 };

let rafCallback = null;
let lastAC = null;

export function pendingFrame() { return rafCallback; }
export function lastAudioContext() { return lastAC; }

/** 推进 n 帧；返回 false 表示 rAF 循环已停（播放结束或被 destroy） */
export function pumpFrames(count, dtMs = 50) {
  for (let k = 0; k < count; k++) {
    clock.now += dtMs;
    const cb = rafCallback;
    rafCallback = null;
    if (!cb) return false;
    cb(clock.now);
  }
  return true;
}

class FakeClassList {
  constructor(node) { this.node = node; }
  _set() { return this.node._classes; }
  add(c) { this._set().add(c); }
  remove(c) { this._set().delete(c); }
  contains(c) { return this._set().has(c); }
  toggle(c, force) {
    const want = force === undefined ? !this._set().has(c) : !!force;
    if (want) this._set().add(c); else this._set().delete(c);
  }
}

export class FakeNode {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attrs = {};
    this.style = {};
    this.listeners = {};
    this.textContent = "";
    this._classes = new Set();
    this.classList = new FakeClassList(this);
    this.parent = null;
  }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this._classes].join(" "); }
  set innerHTML(v) { if (v === "") this.children = []; }
  get innerHTML() { return ""; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }
  appendChild(c) { this.children.push(c); c.parent = this; return c; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  click() { (this.listeners.click || []).forEach((f) => f({ preventDefault() {} })); }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
  }
}

/* 可用的假 AudioContext：让 tone() 的完整代码路径在测试里真实执行，
 * 而不是被 try/catch 悄悄吞掉（那样就测不出音频崩播放的 bug）。 */
class FakeAudioParam {
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}

class FakeAudioContext {
  constructor() {
    lastAC = this;
    this.state = "running";
    this.currentTime = 0;
    this.destination = {};
  }
  createGain() { return { gain: new FakeAudioParam(), connect() {} }; }
  createOscillator() {
    return { type: "", frequency: new FakeAudioParam(), connect() {}, start() {}, stop() {} };
  }
  resume() { this.state = "running"; return Promise.resolve(); }
}

export function installDomStub() {
  rafCallback = null;
  clock.now = 0;
  globalThis.Node = FakeNode;
  globalThis.window = {
    addEventListener() {},
    AudioContext: FakeAudioContext,
    webkitAudioContext: undefined,
  };
  globalThis.performance = { now: () => clock.now };
  globalThis.requestAnimationFrame = (f) => { rafCallback = f; return 1; };
  globalThis.cancelAnimationFrame = () => { rafCallback = null; };
  globalThis.document = {
    createElement: (t) => new FakeNode(t),
    createElementNS: (ns, t) => new FakeNode(t),
    createTextNode: (t) => { const n = new FakeNode("#text"); n.textContent = String(t); return n; },
  };
}

/** 替换 AudioContext 实现（用于模拟被浏览器策略拦截的场景） */
export function setAudioContext(impl) { globalThis.window.AudioContext = impl; }
export function getAudioContext() { return globalThis.window.AudioContext; }

/** 断言工具：两个测试共用同一套计数与汇总 */
export function createChecker() {
  const state = { passed: 0, failures: [] };
  return {
    ok(cond, name) {
      if (cond) { state.passed++; console.log(`  ✓ ${name}`); }
      else { state.failures.push(name); console.log(`  ✗ ${name}`); }
    },
    section(title) { console.log(`\n${title}`); },
    finish(label = "") {
      console.log(`\n${state.passed} 项通过，${state.failures.length} 项失败`);
      if (state.failures.length) {
        console.log("失败项：");
        state.failures.forEach((f) => console.log(`  - ${f}`));
        process.exit(1);
      }
      return state.passed;
    },
    get count() { return state.passed; },
  };
}
