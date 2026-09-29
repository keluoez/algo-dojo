"""内容只读接口：目录、知识点、编程题。

题解不设门禁：题目详情直接带出 solution_code / solution_md，
任何时候都能看——本平台是查漏补缺用的，卡住答案只会增加摩擦。
想自己先做再看的话不看题解页即可，不靠服务端藏。
"""
from fastapi import APIRouter, HTTPException

from ..content.loader import get_repository
from ..content.models import Problem

router = APIRouter(prefix="/api", tags=["content"])


def _card(problem: Problem) -> dict:
    """卡片字段：列表与「配套练习」引用只需要这些，不下发题解与测试数据。"""
    return {
        "slug": problem.slug,
        "lc": problem.lc,
        "title": problem.title,
        "difficulty": problem.difficulty,
        "topics": problem.topics,
        "tags": problem.tags,
        "has_bench": problem.bench is not None,
    }


@router.get("/catalog")
def get_catalog():
    return get_repository().catalog()


@router.get("/topics/{slug}")
def get_topic(slug: str):
    topic = get_repository().get_topic(slug)
    if not topic:
        raise HTTPException(404, "知识点不存在")
    return topic.model_dump()


@router.get("/problems")
def list_problems(topic: str | None = None):
    if topic and not get_repository().get_topic(topic):
        raise HTTPException(404, "知识点不存在")
    return [_card(p) for p in get_repository().list_problems(topic)]


@router.get("/problems/{slug}")
def get_problem(slug: str):
    """题目详情：含题面、判题数据与完整题解。"""
    problem = get_repository().get_problem(slug)
    if not problem:
        raise HTTPException(404, "题目不存在")
    return problem.model_dump()
