#!/usr/bin/env bash
# 构建并发布到 GitHub Pages（gh-pages 分支）
# 用法：./deploy.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/2385347602/ai-eng-roadmap.git}"
BASE_PATH_VALUE="/ai-eng-roadmap/"
OUT_DIR_VALUE="./.vitepress/site-build"

cd "$(dirname "$0")"

echo "==> 清理旧产物"
rm -rf "docs/${OUT_DIR_VALUE#./}" 2>/dev/null || true

echo "==> 构建"
OUT_DIR="$OUT_DIR_VALUE" BASE_PATH="$BASE_PATH_VALUE" npx vitepress build docs

SITE_DIR="docs/${OUT_DIR_VALUE#./}"
if [ ! -f "$SITE_DIR/index.html" ]; then
  echo "构建失败：找不到 index.html" >&2
  exit 1
fi

echo "==> 提交"
cd "$SITE_DIR"
git init -q -b gh-pages 2>/dev/null || true
git add -A
git -c user.name="deploy-bot" -c user.email="deploy@local" \
    commit -q -m "deploy: $(date '+%Y-%m-%d %H:%M')" || echo "（无变化，跳过提交）"

echo "==> 推送"
git push -f "$REPO_URL" gh-pages:gh-pages

echo "==> 完成，GitHub 会在 1~2 分钟内重新发布"
echo "    https://2385347602.github.io/ai-eng-roadmap/"
