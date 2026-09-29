"""Worker 判题脚本协议校验。

背景：判题逻辑写在 frontend/js/pyodide-worker.js 里的 Python 模板字符串中，
只有浏览器里跑 Pyodide 才会真正执行——模板改坏了，Python 侧测试全绿也发现不了
（DESIGN 第 8 节的"args_code 键存在性误判"就是这么漏出去的）。

本脚本用 CPython 直接执行那几个模板，校验协议与真值判断：
- JUDGE_PY：函数题（args/args_code）、类设计题、用户代码报错、返回 {rows, ms}
- BENCH_PY：生成器可跑、多解法逐规模计时、单个解法报错不影响其它行
- DEMO_PY：知识点操作示例，exec 整段脚本并回收 stdout，报错不崩

运行：python -m tests.check_worker_protocol
"""
import json
import re
from pathlib import Path

WORKER = Path(__file__).resolve().parent.parent / "frontend" / "js" / "pyodide-worker.js"

failures: list[str] = []


def check(name: str, cond: bool, extra: str = ""):
    if not cond:
        failures.append(f"{name} {extra}")
    print(("✓ " if cond else "✗ ") + name + (f"  {extra}" if not cond and extra else ""))


def template(name: str) -> str:
    src = WORKER.read_text(encoding="utf-8")
    match = re.search(r"const %s = `\n(.*?)\n`;" % name, src, re.DOTALL)
    if not match:
        raise SystemExit(f"未在 {WORKER.name} 中找到模板 {name}")
    return match.group(1)


def run(code: str, namespace: dict):
    """模拟 pyodide.runPythonAsync：执行脚本，并把最后一行表达式的值作为返回值。"""
    lines = code.strip().split("\n")
    exec(compile("\n".join(lines[:-1]), "<worker>", "exec"), namespace)
    return eval(compile(lines[-1], "<worker>", "eval"), namespace)


def judge(**namespace) -> dict:
    base = {
        "__setup_code__": "",
        "__user_code__": "",
        "__adapter_code__": "",
        "__cases_json__": "[]",
        "__scenarios_json__": "[]",
        "__entry__": "",
    }
    base.update(namespace)
    return json.loads(run(template("JUDGE_PY"), base))


def demo(code: str) -> dict:
    return json.loads(run(template("DEMO_PY"), {"__demo_code__": code}))


def run_checks() -> None:
    # ---------- 函数题：位置参数 ----------
    res = judge(
        __user_code__="def add(a, b):\n    return a + b\n",
        __cases_json__=json.dumps([
            {"desc": "1+2", "args": [1, 2], "expected": 3},
            {"desc": "期望故意写错", "args": [2, 2], "expected": 5},
        ]),
        __entry__="add",
    )
    rows = res["rows"]
    check("函数题返回 rows/ms 结构", "rows" in res and "ms" in res)
    check("函数题逐行结果正确",
          [r.get("actual") for r in rows] == [3, 4])
    check("函数题期望值原样带回", rows[1]["expected"] == 5)
    check("执行耗时为正数", res["ms"] >= 0)

    # ---------- 函数题：args_code 走 eval，空串必须被真值判断跳过 ----------
    # 老 bug：用 `"args_code" in _c` 判断键是否存在，而 model_dump 会把空串一起序列化，
    # 于是 eval("") 抛 SyntaxError，所有函数题全挂。
    res = judge(
        __setup_code__="def build(xs):\n    return tuple(xs)\n",
        __user_code__="def total(pair):\n    return sum(pair)\n",
        __cases_json__=json.dumps([
            {"desc": "空 args_code 走 args", "args": [[1, 2, 3]], "expected": 6},
            {"desc": "args_code 表达式", "args": [], "args_code": "(build([1, 2, 3]),)", "expected": 6},
        ]),
        __entry__="total",
    )
    rows = res["rows"]
    check("空 args_code 不走 eval（真值判断）",
          rows[0].get("actual") == 6 and "error" not in rows[0],
          rows[0].get("error", ""))
    check("args_code 表达式求值后传参", rows[1].get("actual") == 6)

    # ---------- result_adapter ----------
    res = judge(
        __user_code__="def pair():\n    return (1, 2)\n",
        __adapter_code__="def adapt(result):\n    return list(result)\n",
        __cases_json__=json.dumps([{"desc": "适配", "args": [], "expected": [1, 2]}]),
        __entry__="pair",
    )
    check("result_adapter 生效", res["rows"][0].get("actual") == [1, 2])

    # ---------- 类设计题 ----------
    res = judge(
        __user_code__=(
            "class Counter:\n"
            "    def __init__(self, n=0):\n"
            "        self.n = n\n"
            "    def add(self, k):\n"
            "        self.n += k\n"
            "        return self.n\n"
        ),
        __scenarios_json__=json.dumps([{
            "init_args": [1],
            "steps": [
                {"op": "add", "args": [2], "expected": 3},
                {"op": "add", "args": [5], "expected": 8},
            ],
        }]),
        __entry__="Counter",
    )
    rows = res["rows"]
    check("类设计题按步骤调用", [r.get("actual") for r in rows] == [3, 8])
    check("类设计题用例名含方法签名", rows[0]["desc"] == "add(2)")

    # ---------- 用户代码报错 ----------
    res = judge(
        __user_code__="def add(a, b):\n    raise ValueError('boom')\n",
        __cases_json__=json.dumps([{"desc": "抛错", "args": [1, 2], "expected": 3}]),
        __entry__="add",
    )
    check("用户代码抛错被逐行捕获",
          "ValueError" in res["rows"][0].get("error", "")
          and "actual" not in res["rows"][0])

    # 语法错误：所有行都要带上初始化错误，而不是整段崩掉
    res = judge(
        __user_code__="def add(a, b):\n    return a ++\n",
        __cases_json__=json.dumps([{"desc": "1", "args": [1, 2], "expected": 3}]),
        __entry__="add",
    )
    check("语法错误降级为逐行 error", "SyntaxError" in res["rows"][0].get("error", ""))

    # ---------- 性能实测 ----------
    res = run(template("BENCH_PY"), {
        "__setup_code__": "",
        "__gen_code__": "import random\ndef make_input(n):\n    random.seed(1)\n    return ([random.randint(0, 10**6) for _ in range(n)],)\n",
        "__entry__": "solve",
        "__solutions_json__": json.dumps([
            {"name": "暴力", "code": "def solve(xs):\n    c = 0\n    for i in range(len(xs)):\n        for j in range(i + 1, len(xs)):\n            if xs[i] > xs[j]:\n                c += 1\n    return c\n"},
            {"name": "递增", "code": "def solve(xs):\n    for i in range(len(xs)):\n        pass\n    return 0\n"},
            {"name": "坏解法", "code": "def solve(xs):\n    return undefined_name\n"},
        ]),
        "__scales_json__": json.dumps([50, 100]),
    })
    rows = json.loads(res)
    check("性能实测逐规模出结果",
          sorted({(r["name"], r["n"]) for r in rows if "ms" in r})
          == [("暴力", 50), ("暴力", 100), ("递增", 50), ("递增", 100)])
    slow = next(r["ms"] for r in rows if r["name"] == "暴力" and r["n"] == 100)
    fast = next(r["ms"] for r in rows if r["name"] == "递增" and r["n"] == 100)
    check("暴力解法显著慢于线性解法", slow > fast, f"{slow:.3f}ms vs {fast:.3f}ms")
    bad = [r for r in rows if r["name"] == "坏解法"]
    check("单个解法报错不影响其它解法",
          len(bad) == 1 and "NameError" in bad[0].get("error", ""))

    # ---------- 知识点操作示例 ----------
    res = demo("print(1 + 1)")
    check("示例脚本回收 stdout", res["output"] == "2\n" and res["error"] is None)

    # 知识点示例是「公共定义 + 操作实现 + 演示」拼成的一整段，
    # 必须同一个命名空间，否则 demo 调不到 code 里定义的函数
    res = demo("def push(x):\n    return x * 2\nprint(push(21))")
    check("示例整段共享命名空间（demo 能调用 code 里的函数）",
          res["output"] == "42\n" and res["error"] is None)

    res = demo("print('半截输出')\nraise ValueError('boom')")
    check("示例脚本报错被捕获而不是整段崩掉",
          "ValueError" in (res["error"] or "") and res["output"] == "半截输出\n")

    res = demo("x = 1")
    check("没有 print 时输出为空串", res["output"] == "" and res["error"] is None)


def main() -> int:
    print(f"校验 {WORKER.name} 的判题模板\n")
    run_checks()
    print(f"\n失败 {len(failures)} 项")
    for name in failures:
        print(f"  ✗ {name}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
