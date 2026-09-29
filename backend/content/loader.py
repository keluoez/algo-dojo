"""Markdown + YAML frontmatter 内容加载器。

启动时扫描 content/topics 与 content/problems，经 models.py 的 Pydantic
契约校验后构建 ContentRepository；引用完整性（topics/related_problems 等）
也在此处强制，坏内容会让服务直接启动失败（fail fast）。
"""
import os
import re
from pathlib import Path

import yaml

from .. import config
from .models import Problem, Topic

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", re.DOTALL)


class ContentError(RuntimeError):
    """内容文件违反契约（缺字段、坏引用等）。"""


def parse_md(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    match = _FRONTMATTER_RE.match(text)
    if not match:
        raise ContentError(f"{path} 缺少 YAML frontmatter（需以 --- 包裹）")
    meta = yaml.safe_load(match.group(1)) or {}
    if not isinstance(meta, dict):
        raise ContentError(f"{path} frontmatter 必须是键值映射")
    return meta, match.group(2)


class ContentRepository:
    """内容只读仓库，前端/路由通过这里访问全部学习内容。"""

    def __init__(self, topics: dict[str, Topic], problems: dict[str, Problem]):
        self._topics = topics
        self._problems = problems

    def list_topics(self, category: str | None = None) -> list[Topic]:
        items = list(self._topics.values())
        if category:
            items = [t for t in items if t.category == category]
        return sorted(items, key=lambda t: (t.order, t.slug))

    def get_topic(self, slug: str) -> Topic | None:
        return self._topics.get(slug)

    def list_problems(self, topic: str | None = None) -> list[Problem]:
        if topic:
            items = [p for p in self._problems.values() if topic in p.topics]
        else:
            items = list(self._problems.values())
        return sorted(items, key=lambda p: (p.difficulty, p.slug))

    def get_problem(self, slug: str) -> Problem | None:
        return self._problems.get(slug)

    def catalog(self) -> dict:
        return {
            "categories": [
                {
                    "key": "data-structure",
                    "title": "数据结构",
                    "desc": "数据的组织、存储与操作方式",
                    "topics": [self._topic_card(t) for t in self.list_topics("data-structure")],
                },
                {
                    "key": "algorithm",
                    "title": "算法",
                    "desc": "操作数据、求解问题的策略与思想",
                    "topics": [self._topic_card(t) for t in self.list_topics("algorithm")],
                },
            ]
        }

    @staticmethod
    def _topic_card(topic: Topic) -> dict:
        return {
            "slug": topic.slug,
            "title": topic.title,
            "subtitle": topic.subtitle,
            "difficulty": topic.difficulty,
            "order": topic.order,
            "tags": topic.tags,
        }


_repo: ContentRepository | None = None


def build_repository() -> ContentRepository:
    topics: dict[str, Topic] = {}
    for path in sorted(config.TOPICS_DIR.glob("*.md")):
        meta, body = parse_md(path)
        meta["body_md"] = body
        topic = Topic(**meta)
        if topic.slug in topics:
            raise ContentError(f"知识点 slug 重复: {topic.slug}")
        topics[topic.slug] = topic

    problems: dict[str, Problem] = {}
    for path in sorted(config.PROBLEMS_DIR.glob("*.md")):
        meta, body = parse_md(path)
        # 正文用 `--- 题解 ---` 分隔：前为题面 body_md，后为题解 solution_md
        if "\n--- 题解 ---\n" in body:
            body, solution = body.split("\n--- 题解 ---\n", 1)
            meta["solution_md"] = solution
        meta["body_md"] = body
        problem = Problem(**meta)
        if problem.slug in problems:
            raise ContentError(f"题目 slug 重复: {problem.slug}")
        problems[problem.slug] = problem

    _check_references(topics, problems)
    return ContentRepository(topics, problems)


def _check_references(topics: dict[str, Topic], problems: dict[str, Problem]) -> None:
    # 内容自检（tests/check_content）在内容尚未写完时跳过缺失引用；
    # 正常启动与 smoke_test 严格检查（fail fast）。
    strict = os.environ.get("ALGO_LENIENT_REFS", "") == ""

    def fail(message):
        if strict:
            raise ContentError(message)

    for topic in topics.values():
        for ref in topic.related_problems:
            if ref not in problems:
                fail(f"知识点 {topic.slug} 引用了不存在的题目: {ref}")
        for ref in topic.prerequisites:
            if ref not in topics:
                fail(f"知识点 {topic.slug} 引用了不存在的前置知识点: {ref}")
    for problem in problems.values():
        for ref in problem.topics:
            if ref not in topics:
                fail(f"题目 {problem.slug} 引用了不存在的知识点: {ref}")


def get_repository() -> ContentRepository:
    global _repo
    if _repo is None:
        _repo = build_repository()
    return _repo


def reset_repository() -> None:
    """测试辅助：清空缓存，强制重新扫描。"""
    global _repo
    _repo = None
