"""学习数据接口：已学标记、判题结果上报、错题本、学习看板、性能实测存档。"""
import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import db
from ..content.loader import get_repository

router = APIRouter(prefix="/api", tags=["progress"])


# ---------------- 请求体模型 ----------------


class MarkIn(BaseModel):
    learned: bool


class AttemptIn(BaseModel):
    code: str = Field(default="", max_length=20000)
    passed: int = Field(ge=0)
    total: int = Field(ge=1)
    duration_ms: int = Field(default=0, ge=0)


class QuizIn(BaseModel):
    quiz_index: int = Field(ge=0)
    correct: bool


class BenchIn(BaseModel):
    results: list[dict] = Field(min_length=1, max_length=100)


# ---------------- 知识点与小测 ----------------


@router.post("/topics/{slug}/mark")
def mark_topic(slug: str, body: MarkIn):
    if not get_repository().get_topic(slug):
        raise HTTPException(404, "知识点不存在")
    if body.learned:
        db.execute(
            """INSERT INTO topic_progress(topic_slug, learned, learned_at)
               VALUES (?, 1, datetime('now','localtime'))
               ON CONFLICT(topic_slug) DO UPDATE SET
                 learned=1, learned_at=COALESCE(topic_progress.learned_at,
                              datetime('now','localtime')),
                 updated_at=datetime('now','localtime')""",
            (slug,),
        )
    else:
        db.execute(
            "UPDATE topic_progress SET learned=0, updated_at=datetime('now','localtime') WHERE topic_slug=?",
            (slug,),
        )
    return {"ok": True}


@router.post("/topics/{slug}/quiz")
def submit_quiz(slug: str, body: QuizIn):
    topic = get_repository().get_topic(slug)
    if not topic:
        raise HTTPException(404, "知识点不存在")
    if body.quiz_index >= len(topic.quizzes):
        raise HTTPException(400, "小测题号超出范围")
    db.execute(
        "INSERT INTO quiz_attempts(topic_slug, quiz_index, correct) VALUES (?, ?, ?)",
        (slug, body.quiz_index, int(body.correct)),
    )
    return {"ok": True}


# ---------------- 判题结果与掌握度 ----------------


@router.post("/problems/{slug}/attempts")
def submit_attempt(slug: str, body: AttemptIn):
    if not get_repository().get_problem(slug):
        raise HTTPException(404, "题目不存在")
    if body.passed > body.total:
        raise HTTPException(400, "通过用例数不能大于总用例数")

    db.execute(
        """INSERT INTO problem_attempts(problem_slug, code, passed, total, duration_ms)
           VALUES (?, ?, ?, ?, ?)""",
        (slug, body.code, body.passed, body.total, body.duration_ms),
    )

    all_passed = body.passed == body.total
    # 掌握度 upsert：通过则 pass_count+1 并置为 passed，否则 fail_count+1 进错题本
    db.execute(
        """INSERT INTO problem_mastery
               (problem_slug, status, pass_count, fail_count, last_passed_at)
           VALUES (?,
                   CASE WHEN ?=1 THEN 'passed' ELSE 'wrong' END,
                   CASE WHEN ?=1 THEN 1 ELSE 0 END,
                   CASE WHEN ?=1 THEN 0 ELSE 1 END,
                   CASE WHEN ?=1 THEN datetime('now','localtime') END)
           ON CONFLICT(problem_slug) DO UPDATE SET
               status = CASE WHEN ?=1 THEN 'passed' ELSE 'wrong' END,
               pass_count = problem_mastery.pass_count + CASE WHEN ?=1 THEN 1 ELSE 0 END,
               fail_count = problem_mastery.fail_count + CASE WHEN ?=1 THEN 0 ELSE 1 END,
               last_passed_at = COALESCE(
                   CASE WHEN ?=1 THEN datetime('now','localtime') END,
                   problem_mastery.last_passed_at),
               updated_at = datetime('now','localtime')""",
        (slug, int(all_passed), int(all_passed), int(all_passed), int(all_passed),
         int(all_passed), int(all_passed), int(all_passed), int(all_passed)),
    )
    return {"ok": True, "all_passed": all_passed}


# ---------------- 错题本 ----------------


@router.get("/review/wrong")
def wrong_list():
    rows = db.query(
        "SELECT * FROM problem_mastery WHERE status='wrong' ORDER BY updated_at DESC"
    )
    repo = get_repository()
    items = []
    for row in rows:
        problem = repo.get_problem(row["problem_slug"])
        if not problem:
            continue
        items.append(
            {
                "slug": problem.slug,
                "title": problem.title,
                "lc": problem.lc,
                "difficulty": problem.difficulty,
                "fail_count": row["fail_count"],
                "updated_at": row["updated_at"],
            }
        )
    return {"items": items}


@router.post("/review/{slug}/resolve")
def resolve_wrong(slug: str):
    if not get_repository().get_problem(slug):
        raise HTTPException(404, "题目不存在")
    db.execute(
        "UPDATE problem_mastery SET status='passed', updated_at=datetime('now','localtime') WHERE problem_slug=?",
        (slug,),
    )
    return {"ok": True}


# ---------------- 学习看板 ----------------


@router.get("/progress/topics")
def topic_progress_map():
    rows = db.query("SELECT topic_slug, learned FROM topic_progress")
    return {"items": rows}


@router.get("/progress/problems")
def problem_progress_map():
    rows = db.query(
        "SELECT problem_slug, status, pass_count, fail_count FROM problem_mastery"
    )
    return {"items": rows}


@router.get("/progress/overview")
def overview():
    repo = get_repository()
    total_topics = len(repo.list_topics())
    learned = db.query_one("SELECT COUNT(*) c FROM topic_progress WHERE learned=1")["c"]

    total_problems = len(repo.list_problems())
    attempted = db.query_one("SELECT COUNT(*) c FROM problem_mastery")["c"]
    passed = db.query_one("SELECT COUNT(*) c FROM problem_mastery WHERE status='passed'")["c"]
    wrong = db.query_one("SELECT COUNT(*) c FROM problem_mastery WHERE status='wrong'")["c"]

    today_attempts = db.query_one(
        "SELECT COUNT(*) c FROM problem_attempts WHERE date(created_at)=date('now','localtime')"
    )["c"]
    quiz_correct = db.query_one("SELECT COUNT(*) c FROM quiz_attempts WHERE correct=1")["c"]

    return {
        "topics": {"total": total_topics, "learned": learned},
        "problems": {
            "total": total_problems,
            "attempted": attempted,
            "passed": passed,
            "wrong": wrong,
        },
        "today_attempts": today_attempts,
        "quiz_correct": quiz_correct,
    }


# ---------------- 性能实测存档 ----------------


@router.post("/bench")
def save_bench(body: BenchIn):
    problem_slug = body.results[0].get("problem_slug", "")
    if not get_repository().get_problem(problem_slug):
        raise HTTPException(404, "题目不存在")
    row_id = db.execute(
        "INSERT INTO bench_runs(problem_slug, payload_json) VALUES (?, ?)",
        (problem_slug, json.dumps(body.results, ensure_ascii=False)),
    )
    return {"ok": True, "id": row_id}
