"""算法修炼场 · FastAPI 入口。

职责：初始化数据库与内容仓库、挂载路由、托管前端静态文件。
业务路由按域拆分在 routers/ 下（比单文件更易维护）。
"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import config, db
from .content.loader import build_repository
from .routers import content, progress

app = FastAPI(title="算法修炼场")

db.init_db()
build_repository()  # 启动即加载并校验全部内容契约；内容有坏则启动失败

app.include_router(content.router)
app.include_router(progress.router)


@app.get("/api/health")
def health():
    return {"ok": True, "name": "算法修炼场"}


# 前端静态文件放最后挂载，避免吞掉 /api 路由
app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config.HOST, port=config.PORT)
