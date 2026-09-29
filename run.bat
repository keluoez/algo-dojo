@echo off
chcp 65001 >nul
cd /d %~dp0
title 算法修炼场
start "" "http://127.0.0.1:8767"
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8767
pause
