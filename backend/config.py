"""全局配置：路径、端口与运行参数。

所有路径以本文件位置为锚点，保证从任意工作目录启动都能找到资源。
可用环境变量 ALGO_DB_PATH 覆盖数据库位置（测试时指向临时库）。
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

FRONTEND_DIR = BASE_DIR / "frontend"
CONTENT_DIR = BASE_DIR / "content"
TOPICS_DIR = CONTENT_DIR / "topics"
PROBLEMS_DIR = CONTENT_DIR / "problems"
DATA_DIR = BASE_DIR / "data"

DB_PATH = Path(os.environ.get("ALGO_DB_PATH", DATA_DIR / "app.db"))

HOST = os.environ.get("ALGO_HOST", "127.0.0.1")
PORT = int(os.environ.get("ALGO_PORT", "8767"))

# Pyodide 优先加载本地 vendor（完全离线）；本地缺失时回退到此 CDN。
PYODIDE_INDEX_URL = "/vendor/pyodide/"
PYODIDE_CDN_FALLBACK = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
