"""端到端冒烟测试：TestClient 直跑，覆盖内容契约、学习数据流转与边界。

运行：python -m tests.smoke_test
会自动把 DB 指到临时文件，不污染正式学习数据。
每道题 solution_code 的真实 Python 执行由 tests/check_content.py 负责。
"""
import os
import tempfile

os.environ["ALGO_DB_PATH"] = os.path.join(tempfile.mkdtemp(), "smoke.db")

from fastapi.testclient import TestClient  # noqa: E402

from backend.main import app  # noqa: E402

checks: list[tuple[str, bool, str]] = []


def check(name: str, cond: bool, extra: str = ""):
    checks.append((name, bool(cond), extra))


def run() -> int:
    with TestClient(app) as client:
        # ---------- 基础 ----------
        check("健康检查 200", client.get("/api/health").status_code == 200)
        check("首页 HTML 已挂载",
              client.get("/").status_code == 200
              and "id=\"app\"" in client.get("/").text)

        # ---------- 目录结构 ----------
        catalog = client.get("/api/catalog").json()
        categories = {c["key"]: c for c in catalog["categories"]}
        check("目录含 2 个大类", len(categories) == 2)
        check("数据结构 11 个子类", len(categories["data-structure"]["topics"]) == 11)
        check("算法 9 个子类", len(categories["algorithm"]["topics"]) == 9)

        topic_slugs = [
            t["slug"] for t in
            categories["data-structure"]["topics"] + categories["algorithm"]["topics"]
        ]
        check("知识点合计 20 个", len(topic_slugs) == 20)

        # ---------- 知识点详情契约 ----------
        ds_slugs = {t["slug"] for t in categories["data-structure"]["topics"]}
        op_total = 0
        for slug in topic_slugs:
            resp = client.get(f"/api/topics/{slug}")
            if resp.status_code != 200:
                check(f"知识点 {slug} 可访问", False, f"HTTP {resp.status_code}")
                continue
            topic = resp.json()
            check(f"知识点 {slug} 正文非空", len(topic["body_md"]) > 100)
            check(f"知识点 {slug} 小测 3-5 题", 3 <= len(topic["quizzes"]) <= 5)
            for i, quiz in enumerate(topic["quizzes"]):
                legal = 0 <= quiz["answer"] < len(quiz["options"])
                check(f"知识点 {slug} 小测 {i} 答案合法", legal)

            ops = topic["operations"]
            op_total += len(ops)
            if slug in ds_slugs:
                check(f"知识点 {slug} 至少 4 个基本操作示例",
                      len(ops) >= 4, f"实际 {len(ops)} 个")
                check(f"知识点 {slug} 操作示例覆盖增删改查",
                      {"增", "删", "改", "查"} <= {op["kind"] for op in ops},
                      f"只有 {sorted({op['kind'] for op in ops})}")
            check(f"知识点 {slug} 操作示例字段完整",
                  all({"name", "kind", "desc", "code", "demo", "output"} <= set(op)
                      and op["code"].strip() and op["demo"].strip()
                      and op["output"].strip()
                      for op in ops))
        check("操作示例合计 87 个", op_total == 87, f"实际 {op_total} 个")

        # ---------- 题目列表与详情契约 ----------
        problems = client.get("/api/problems").json()
        problem_slugs = [p["slug"] for p in problems]
        check("编程题合计 63 道", len(problems) == 63, f"实际 {len(problems)}")

        check("列表接口不下发题解与测试数据",
              all("solution_code" not in p and "solution_md" not in p
                  and "tests" not in p and "bench" not in p for p in problems))
        check("列表卡片字段齐全",
              all({"slug", "lc", "title", "difficulty",
                   "topics", "tags", "has_bench"} <= set(p) for p in problems))

        for slug in problem_slugs:
            resp = client.get(f"/api/problems/{slug}")
            if resp.status_code != 200:
                check(f"题目 {slug} 可访问", False)
                continue
            problem = resp.json()
            check(f"题目 {slug} 详情直接带完整题解",
                  len(problem["solution_code"]) > 10
                  and len(problem["solution_md"]) > 50
                  and "solution_unlocked" not in problem)
            check(f"题目 {slug} 判题数据齐全",
                  bool(problem["entry"]) and bool(problem["starter_code"])
                  and bool(problem["tests"] or problem["scenarios"]))
            check(f"题目 {slug} 题面与题解分离",
                  "--- 题解" not in problem["body_md"] and len(problem["body_md"]) > 50)

        # 按知识点过滤
        ds_array_problems = client.get("/api/problems?topic=ds-array").json()
        check("按知识点过滤题目", any(p["slug"] == "p-lc1109" for p in ds_array_problems))
        check("按不存在的知识点过滤 → 404",
              client.get("/api/problems?topic=no-such-topic").status_code == 404)

        # ---------- 题解不设门禁 ----------
        check("题解专用接口已下线（改由详情直出）",
              client.get("/api/problems/p-lc1/solution").status_code == 404)

        # 旧行为里这两种情况都会被门禁挡住，现在都必须能看
        client.post("/api/problems/p-lc1109/attempts", json={"passed": 0, "total": 2})
        client.post("/api/review/p-lc1109/resolve")
        free = client.get("/api/problems/p-lc1109").json()
        check("答错 + 点「我会了」也照样能看题解",
              len(free["solution_code"]) > 10 and len(free["solution_md"]) > 50)

        missing = []
        for slug in problem_slugs:
            detail = client.get(f"/api/problems/{slug}").json()
            if len(detail["solution_code"]) <= 10 or len(detail["solution_md"]) <= 50:
                missing.append(slug)
        check("63 道题未做任何提交也能看完整题解", not missing, f"缺失：{missing}")

        # ---------- 学习数据完整流转 ----------
        # 1) 标记已学 + 小测
        check("标记已学",
              client.post("/api/topics/ds-array/mark", json={"learned": True}).is_success)
        check("提交小测结果",
              client.post("/api/topics/ds-array/quiz",
                          json={"quiz_index": 0, "correct": True}).is_success)
        overview = client.get("/api/progress/overview").json()
        check("看板已学数 = 1", overview["topics"]["learned"] == 1)
        check("看板小测答对数 = 1", overview["quiz_correct"] == 1)

        # 2) 答错 → 进错题本
        target = "p-lc1"
        resp = client.post(f"/api/problems/{target}/attempts",
                           json={"code": "wrong", "passed": 0,
                                 "total": 2, "duration_ms": 12})
        check("失败提交成功", resp.is_success and resp.json()["all_passed"] is False)
        wrong = client.get("/api/review/wrong").json()["items"]
        check("错题本收录", any(i["slug"] == target for i in wrong))
        overview = client.get("/api/progress/overview").json()
        check("看板错题数 = 1", overview["problems"]["wrong"] == 1)

        # 3) 再次答对 → 移出错题本
        resp = client.post(f"/api/problems/{target}/attempts",
                           json={"code": "ok", "passed": 2,
                                 "total": 2, "duration_ms": 30})
        check("通过提交成功", resp.json()["all_passed"] is True)
        wrong = client.get("/api/review/wrong").json()["items"]
        check("通过后移出错题本", all(i["slug"] != target for i in wrong))

        # 4) 手动"我会了"解除
        other = "p-lc206"
        client.post(f"/api/problems/{other}/attempts",
                    json={"passed": 0, "total": 1})
        check("第二道题进错题本",
              any(i["slug"] == other for i in client.get("/api/review/wrong").json()["items"]))
        check("手动解除错题",
              client.post(f"/api/review/{other}/resolve").is_success)
        check("解除后错题本不含该题",
              all(i["slug"] != other for i in client.get("/api/review/wrong").json()["items"]))

        # 取消已学标记
        check("取消已学",
              client.post("/api/topics/ds-array/mark", json={"learned": False}).is_success)
        check("已学数归零",
              client.get("/api/progress/overview").json()["topics"]["learned"] == 0)

        # ---------- 性能实测存档 ----------
        resp = client.post("/api/bench", json={"results": [
            {"problem_slug": "p-lc1", "name": "哈希", "n": 1000, "ms": 0.5},
            {"problem_slug": "p-lc1", "name": "暴力", "n": 1000, "ms": 50},
        ]})
        check("性能实测存档", resp.is_success)

        # ---------- 404 / 422 / 400 边界 ----------
        check("未知知识点 404",
              client.get("/api/topics/no-such-topic").status_code == 404)
        check("未知题目 404",
              client.get("/api/problems/p-lc999").status_code == 404)
        check("向未知题目上报 404",
              client.post("/api/problems/p-lc999/attempts",
                          json={"passed": 1, "total": 1}).status_code == 404)
        check("总用例数为 0 → 422",
              client.post(f"/api/problems/{target}/attempts",
                          json={"passed": 0, "total": 0}).status_code == 422)
        check("通过数大于总数 → 400",
              client.post(f"/api/problems/{target}/attempts",
                          json={"passed": 3, "total": 2}).status_code == 400)
        check("小测题号越界 → 400",
              client.post("/api/topics/ds-array/quiz",
                          json={"quiz_index": 99, "correct": True}).status_code == 400)
        check("性能实测空结果 → 422",
              client.post("/api/bench", json={"results": []}).status_code == 422)
        check("性能实测未知题目 → 404",
              client.post("/api/bench", json={"results": [
                  {"problem_slug": "p-lc999"}]}).status_code == 404)

    # ---------- 汇总 ----------
    failed = [c for c in checks if not c[1]]
    for name, ok, extra in checks:
        if not ok:
            print(f"✗ {name} {extra}")
    print(f"\n共 {len(checks)} 项断言，失败 {len(failed)} 项")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(run())
