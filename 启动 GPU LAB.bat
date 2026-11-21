@echo off
cd /d "%~dp0"
echo [GPU LAB Pro] 正在启动显卡调试中心...
npm run start
if errorlevel 1 (
  echo.
  echo 启动失败，请确认已安装 Node.js 并执行过 npm install。
  pause
)
