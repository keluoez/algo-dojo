"""内容自检（开发期高频使用，也是 smoke_test 的基础）。

用本机真实 Python 执行每道题的 solution_code，验证：
- 题解通过全部 tests/scenarios（判题语义对齐前端 worker）
- 小测 answer 下标合法
- bench 生成器可执行，make_input 可按每个 scale 产出输入
- 数据结构知识点的基本操作示例：demo 真跑一遍，stdout 必须等于声明的 output

运行：python -m tests.check_content
      python -m tests.check_content --fix   # 把真实输出写回 md 的 output 字段
"""
import io
import json
import os
import sys
import traceback
from contextlib import redirect_stderr, redirect_stdout

os.environ.setdefault("ALGO_LENIENT_REFS", "1")  # 内容编写期允许引用尚未创建的题目

from backend import config
from backend.content.loader import build_repository
from backend.content.models import Problem, Topic


def _json_default(obj):
    if isinstance(obj, tuple):
        return list(obj)
    if isinstance(obj, (set, frozenset)):
        try:
            return sorted(obj)
        except TypeError:
            return sorted(obj, key=str)
    return str(obj)


def _norm(value):
    return json.loads(json.dumps(value, ensure_ascii=False, default=_json_default))


def deep_equal(a, b) -> bool:
    return json.dumps(a, sort_keys=True, ensure_ascii=False, default=_json_default) == \
           json.dumps(b, sort_keys=True, ensure_ascii=False, default=_json_default)


def unordered_equal(a, b) -> bool:
    if not isinstance(a, list) or not isinstance(b, list) or len(a) != len(b):
        return False
    sa = sorted(json.dumps(v, ensure_ascii=False, default=_json_default) for v in a)
    sb = sorted(json.dumps(v, ensure_ascii=False, default=_json_default) for v in b)
    return sa == sb


def run_problem(problem: Problem) -> list[tuple[bool, str]]:
    g: dict = {}
    init_err = ""
    try:
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            exec(problem.setup_code, g)
            exec(problem.solution_code, g)
            if problem.result_adapter:
                exec(problem.result_adapter, g)
    except Exception:
        init_err = traceback.format_exc()

    results: list[tuple[bool, str]] = []

    def record(desc, expected, unordered, fn):
        if init_err:
            results.append((False, f"{desc}: {init_err.splitlines()[-1]}"))
            return
        try:
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                actual = fn()
            if "adapt" in g:
                actual = g["adapt"](actual)
            actual = _norm(actual)
            ok = unordered_equal(actual, expected) if unordered \
                else deep_equal(actual, expected)
            results.append((ok, "" if ok else f"{desc}: expected {expected}, got {actual}"))
        except Exception:
            results.append((False, f"{desc}: {traceback.format_exc().splitlines()[-1]}"))

    for i, tc in enumerate(problem.tests):
        def fn(tc=tc):
            if tc.args_code:
                return g[problem.entry](*eval(tc.args_code, g))
            return g[problem.entry](*tc.args)
        record(tc.desc or f"用例 {i+1}", tc.expected, tc.unordered, fn)

    for scenario in problem.scenarios:
        obj = g[problem.entry](*scenario.init_args)
        for step in scenario.steps:
            def fn(obj=obj, step=step):
                return getattr(obj, step.op)(*step.args)
            desc = f"{step.op}({', '.join(repr(a) for a in step.args)})"
            record(desc, step.expected, False, fn)

    return results


def check_bench(problem: Problem) -> str:
    if not problem.bench:
        return ""
    g: dict = {}
    try:
        exec(problem.setup_code, g)
        exec(problem.bench.generator, g)
        for n in problem.bench.scales:
            args = g["make_input"](n)
            if not isinstance(args, tuple):
                return f"make_input({n}) 必须返回 tuple"
        return ""
    except Exception:
        return traceback.format_exc()


def op_script(topic: Topic, op) -> str:
    """拼接出前端运行示例时真正执行的脚本：公共定义 + 操作实现 + 演示。

    必须与 frontend/js/views/topic.js 里的拼法一致，否则"本地校验过了、
    浏览器里跑出来的却是另一回事"。
    """
    return "\n\n".join(
        part for part in (topic.ops_setup, op.code, op.demo) if part.strip()
    )


def run_operation(topic: Topic, op) -> tuple[bool, str]:
    buf = io.StringIO()
    try:
        with redirect_stdout(buf), redirect_stderr(io.StringIO()):
            exec(op_script(topic, op), {})
    except Exception:
        return False, f"操作「{op.name}」demo 抛错：{traceback.format_exc().splitlines()[-1]}"
    actual = buf.getvalue().strip()
    if not actual:
        return False, f"操作「{op.name}」demo 没有任何输出，示例看不出结果"
    if actual != op.output.strip():
        return False, f"操作「{op.name}」output 声明 {op.output!r}，实际 {actual!r}"
    return True, ""


def sync_operation_outputs(repo) -> int:
    """把每个操作示例的真实 stdout 写回 md 的 output 字段。

    手写期望输出既累又容易错，示例改一行代码就得跟着改；这个模式让机器写。
    只替换 operations 区块内按出现顺序的 output 行，不动文件其他部分。
    """
    changed = 0
    for topic in repo.list_topics():
        if not topic.operations:
            continue
        outputs = []
        broken = []
        for op in topic.operations:
            buf = io.StringIO()
            try:
                with redirect_stdout(buf), redirect_stderr(io.StringIO()):
                    exec(op_script(topic, op), {})
            except Exception:
                broken.append(op.name)
            outputs.append(buf.getvalue().strip())
        if broken:
            print(f"✗ {topic.slug} 以下示例跑不通，先修代码再同步：{broken}")
            continue

        path = config.TOPICS_DIR / f"{topic.slug}.md"
        lines = path.read_text(encoding="utf-8").split("\n")
        idx, in_ops = 0, False
        for i, line in enumerate(lines):
            if line == "operations:":
                in_ops = True
                continue
            if not in_ops:
                continue
            if line.strip() == "---":  # frontmatter 结束
                break
            if line.strip().startswith("output:"):
                if idx >= len(outputs):
                    raise SystemExit(f"{path.name} 的 output 行数多于示例数")
                indent = line[: len(line) - len(line.lstrip())]
                lines[i] = f"{indent}output: {json.dumps(outputs[idx], ensure_ascii=False)}"
                idx += 1
        if idx != len(outputs):
            raise SystemExit(f"{path.name} 只回填了 {idx}/{len(outputs)} 个 output")
        path.write_text("\n".join(lines), encoding="utf-8")
        changed += len(outputs)
    return changed


def main() -> int:
    repo = build_repository()
    failures = 0
    topics = repo.list_topics()
    problems = repo.list_problems()

    print(f"知识点 {len(topics)} 个，编程题 {len(problems)} 道")

    if "--fix" in sys.argv:
        n = sync_operation_outputs(repo)
        print(f"\n已把 {n} 个操作示例的真实输出写回 md")
        return 0

    op_count = 0
    for topic in topics:
        for i, quiz in enumerate(topic.quizzes):
            if not (0 <= quiz.answer < len(quiz.options)):
                print(f"✗ {topic.slug} quiz[{i}] answer 越界")
                failures += 1

        for op in topic.operations:
            op_count += 1
            ok, msg = run_operation(topic, op)
            if not ok:
                failures += 1
                print(f"✗ {topic.slug} {msg}")

    for problem in problems:
        results = run_problem(problem)
        bad = [r for r in results if not r[0]]
        if bad:
            failures += 1
            print(f"✗ {problem.slug} 题解未通过 {len(bad)}/{len(results)} 用例")
            print("  " + bad[0][1])
        bench_err = check_bench(problem)
        if bench_err:
            failures += 1
            print(f"✗ {problem.slug} bench 生成器异常：{bench_err.splitlines()[-1]}")

    if failures:
        print(f"\n共 {failures} 项失败")
        return 1
    print(f"\n✓ 全部 {len(problems)} 道题的题解均通过其测试用例")
    print(f"✓ {op_count} 个数据结构操作示例均跑通且输出与声明一致")
    return 0


if __name__ == "__main__":
    sys.exit(main())
