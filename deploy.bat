@echo off
echo ========================================
echo   Deploying to GitHub Pages
echo ========================================
echo.

echo [1/4] Adding all changes...
git add .

echo.
echo [2/4] Creating commit...
git commit -m "Add social reading leaderboard with Firebase"

echo.
echo [3/4] Pushing to GitHub...
git push origin dev

echo.
echo [4/4] Building and deploying to GitHub Pages...
npm run deploy

echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
echo.
echo Your changes are now live at:
echo https://sslimane0000.github.io/Lumen/
echo.
pause
