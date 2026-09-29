"""内容契约模型。

知识点（Topic）与编程题（Problem）都以 Markdown + YAML frontmatter 存储，
加载时用本文件的 Pydantic 模型校验：任何字段缺失、类型错误都会在启动期暴露，
这是全平台内容与代码之间唯一的事实契约。
"""
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Category = Literal["data-structure", "algorithm"]

OpKind = Literal["增", "删", "改", "查", "建", "遍历", "其它"]


class Quiz(BaseModel):
    """知识点页内的概念小测（单选/判断）。"""

    q: str = Field(min_length=1)
    options: list[str] = Field(min_length=2)
    answer: int = Field(ge=0, description="正确选项下标，从 0 开始")
    explain: str = ""

    @field_validator("answer")
    @classmethod
    def answer_in_range(cls, v: int, info) -> int:
        options = info.data.get("options") or []
        if options and v >= len(options):
            raise ValueError(f"answer={v} 超出 options 范围(共 {len(options)} 项)")
        return v


class Operation(BaseModel):
    """数据结构的一个基本操作示例（增 / 删 / 改 / 查 …）。

    code 是操作本身的实现；demo 是一段能直接跑的演示脚本（用 print 输出结果）；
    output 是 demo 的期望 stdout——tests/check_content 会用真实 Python 跑一遍比对，
    所以示例写错了会在门禁里立刻暴露，而不是等用户点了运行才发现。
    """

    name: str = Field(min_length=1, description="操作名，如「头插」")
    kind: OpKind = Field(default="其它", description="操作类别，前端据此上色")
    desc: str = Field(default="", description="一句话说明做什么、代价多少")
    code: str = Field(min_length=1, description="操作实现")
    demo: str = Field(min_length=1, description="演示脚本，靠 print 输出结果")
    output: str = Field(default="", description="demo 的期望 stdout")


class Topic(BaseModel):
    """一个子类知识点页，如「数组与字符串」「动态规划」。"""

    slug: str = Field(min_length=1)
    category: Category
    title: str = Field(min_length=1)
    subtitle: str = ""
    order: int = Field(default=0, ge=0)
    difficulty: int = Field(default=1, ge=1, le=3)
    tags: list[str] = Field(default_factory=list)
    prerequisites: list[str] = Field(default_factory=list)
    related_problems: list[str] = Field(default_factory=list)
    quizzes: list[Quiz] = Field(default_factory=list)
    ops_setup: str = Field(
        default="",
        description="操作示例的公共代码：结构定义与辅助函数（如 ListNode、to_list）",
    )
    operations: list[Operation] = Field(default_factory=list)
    body_md: str = ""

    @model_validator(mode="after")
    def ds_needs_operations(self):
        """数据结构必须给出基本操作示例，且每个示例都要跑得出结果。

        只卡 data-structure：算法页的"示例"是动画，两者形态不同。
        """
        if self.category != "data-structure":
            return self
        if len(self.operations) < 4:
            raise ValueError(
                f"数据结构知识点至少提供 4 个基本操作示例，当前 {len(self.operations)} 个"
            )
        for op in self.operations:
            if not op.output.strip():
                raise ValueError(f"操作示例「{op.name}」缺少期望输出 output")
        return self


class TestCase(BaseModel):
    """一条判题用例：args 按顺序传入入口函数。

    链表/树等无法直接用 JSON 表达的输入，用 args_code：
    一段 Python 表达式，求值为参数 tuple，如 "(build_list([1,2,3]),)"。
    """

    desc: str = ""
    args: list[Any] = Field(default_factory=list)
    args_code: str = ""
    expected: Any
    unordered: bool = Field(default=False, description="为 true 时按无序集合比较")


class BenchSpec(BaseModel):
    """性能实测规格：generator 代码需定义 make_input(n)，按 scales 各跑一次。"""

    scales: list[int] = Field(min_length=1)
    generator: str = Field(min_length=1)


class ScenarioStep(BaseModel):
    """类设计题的一步方法调用。"""

    op: str = Field(min_length=1)
    args: list[Any] = Field(default_factory=list)
    expected: Any = None


class Scenario(BaseModel):
    """类设计题场景：用 init_args 构造被测对象，再按 steps 连续调用。"""

    init_args: list[Any] = Field(default_factory=list)
    steps: list[ScenarioStep] = Field(min_length=1)


class Problem(BaseModel):
    """一道编程题。solution_code 必须能通过全部 tests（由 smoke_test 强制）。"""

    slug: str = Field(min_length=1)
    lc: int | None = Field(default=None, description="对应的 LeetCode 题号")
    title: str = Field(min_length=1)
    difficulty: int = Field(default=1, ge=1, le=3)
    topics: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    entry: str = Field(min_length=1, description="入口函数名")
    starter_code: str = Field(min_length=1)
    solution_code: str = Field(min_length=1)
    setup_code: str = Field(default="", description="ListNode/TreeNode 等公共定义")
    tests: list[TestCase] = Field(default_factory=list)
    scenarios: list[Scenario] = Field(default_factory=list)
    result_adapter: str = Field(
        default="",
        description="可选 Python 代码，定义 adapt(result) 将返回值转为可 JSON 序列化对象",
    )
    bench: BenchSpec | None = None
    body_md: str = Field(default="", description="题面（答题页展示）")
    solution_md: str = Field(default="", description="题解讲解（题解页展示）")

    @model_validator(mode="after")
    def at_least_one_test(self):
        """tests 与 scenarios 至少给一种。

        必须用 model_validator(mode="after")：字段级校验器按声明顺序执行，
        校验 tests 时 scenarios 还没进入 info.data，会误判成"两个都为空"。
        """
        if not self.tests and not self.scenarios:
            raise ValueError("tests 与 scenarios 至少提供一种")
        return self
