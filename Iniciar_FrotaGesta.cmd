@echo off
setlocal
set "RAIZ=%~dp0"
set "BACKEND=%RAIZ%backend"
if not exist "%BACKEND%\package.json" (
  echo [%date% %time%] ERRO: Pasta backend nao encontrada em "%BACKEND%" >> "%RAIZ%FrotaGesta_inicializacao.log"
  exit /b 1
)
cd /d "%BACKEND%"
if not exist "logs" mkdir "logs"
echo [%date% %time%] Iniciando FrotaGesta >> "logs\servidor.log"
call npm start >> "logs\servidor.log" 2>&1
set "STATUS=%errorlevel%"
echo [%date% %time%] Servidor encerrado. Codigo: %STATUS% >> "logs\servidor.log"
exit /b %STATUS%
