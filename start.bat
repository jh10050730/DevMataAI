@echo off
chcp 65001 >nul
cd /d "%~dp0"
title DevMate AI
echo DevMate AI 시작 중... (이 창을 닫으면 서버가 꺼집니다)

where node >nul 2>nul || (echo Node.js 가 설치되어 있지 않습니다. & pause & exit /b 1)
if not exist "apps\api\.env" (echo apps\api\.env 가 없습니다. README 의 "내 PC에 설치하기"를 참고하세요. & pause & exit /b 1)

sc query MySQL84 | find "RUNNING" >nul || (
  echo [경고] MySQL84 서비스가 실행 중이 아닙니다. services.msc 에서 MySQL84 를 시작하세요.
)

if not exist "node_modules" (
  echo 처음 실행: 패키지 설치 중...
  call npm install || (pause & exit /b 1)
)

rem 새 마이그레이션이 있으면 적용 (데이터는 지우지 않음)
call npm run db:deploy -w apps/api || (echo 마이그레이션 적용 실패 & pause & exit /b 1)

rem API 가 뜨면 브라우저 열기 (최대 60초 대기)
start "" /b powershell -NoProfile -Command "for($i=0;$i -lt 60;$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health -TimeoutSec 2 | Out-Null; Start-Process 'http://localhost:5173'; break}catch{Start-Sleep 1}}"

call npm run dev
pause
