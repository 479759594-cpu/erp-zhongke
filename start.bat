@echo off
chcp 65001 >nul
title 中科数控售后系统
echo ============================================
echo  中科数控设备报修售后管理系统
echo  广东中科数控科技有限公司
echo ============================================
echo.
echo [1/2] 正在启动本地服务器 (端口 8080)...
start "中科数控-服务器" /min cmd /c "node server.js"
timeout /t 2 /nobreak >nul
echo         本地服务器已启动 ✓
echo.
echo [2/2] 正在建立公网隧道...
echo         请稍候，正在连接公网...
start "中科数控-公网隧道" /min cmd /c "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:8080 nokey@localhost.run 2>&1 | findstr /C:\"tunneled\" /C:\"https://\" > %~dp0tunnel_url_temp.txt & type %~dp0tunnel_url_temp.txt & pause"
timeout /t 8 /nobreak >nul

echo.
echo ============================================
echo  ✅ 系统启动完成！
echo.
echo  📱 客户服务中心（本机访问）：
echo     http://localhost:8080
echo.
echo  🔧 管理后台（本机访问）：
echo     http://localhost:8080/admin
echo.
echo  🌐 公网地址（任何设备均可访问）：
echo     （查看 tunnel_url_temp.txt 文件获取最新地址）
type %~dp0tunnel_url_temp.txt 2>nul
echo.
echo  🔑 管理员: admin / admin123
echo  🔑 售后人员: staff1 / staff123
echo.
echo  📋 注意：公网隧道每次连接URL会变化
echo     请从 tunnel_url_temp.txt 获取最新地址
echo ============================================
echo.
pause