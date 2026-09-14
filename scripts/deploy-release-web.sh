#!/usr/bin/env bash
# ==============================================================================
# LifeLog Sovereign Web Deployment Script
# Deploys obfuscated, zero-leak production bundle (dist/) to Lifelog-Releases
# Public URL: https://krrish1411.github.io/Lifelog-Releases/
# ==============================================================================

set -euo pipefail

# Configuration
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_REPO="${TARGET_REPO:-git@github.com:Krrish1411/Lifelog-Releases.git}"
TARGET_BRANCH="${1:-gh-pages}"
PUBLIC_URL="https://krrish1411.github.io/Lifelog-Releases/"

echo "======================================================================"
echo "  🚀 LifeLog Sovereign Web Production Deployment Pipeline"
echo "  Target: $TARGET_REPO (branch: $TARGET_BRANCH)"
echo "  Live URL: $PUBLIC_URL"
echo "======================================================================"

cd "$REPO_ROOT"

# Step 1: Pre-flight audit
echo "🔍 Running TypeScript typecheck..."
npm run typecheck

# Step 2: Compile hardened production bundle
echo "🔨 Compiling hardened bundle with Terser mangling and console stripping..."
npm run build

if [ ! -d "dist" ]; then
  echo "❌ Error: dist/ directory not found after build!"
  exit 1
fi

# Step 3: Verify anti-theft hardening in dist/
echo "🛡️ Verifying code hardening in dist/..."

# Check 1: Zero sourcemaps
MAP_COUNT=$(find dist -name "*.map" | wc -l)
if [ "$MAP_COUNT" -ne 0 ]; then
  echo "❌ Security Alert: Found $MAP_COUNT source map file(s) in dist/!"
  find dist -name "*.map"
  exit 1
fi
echo "  ✅ Source maps: 0 found (100% stripped)"

# Check 2: Console.log stripped
CONSOLE_COUNT=$(grep -rn "console.log" dist/assets/*.js 2>/dev/null | wc -l || true)
if [ "$CONSOLE_COUNT" -ne 0 ]; then
  echo "⚠️ Warning: Found $CONSOLE_COUNT console.log instances in dist/assets."
else
  echo "  ✅ Console logging: 100% stripped"
fi

# Step 4: Prepare GitHub Pages assets in dist/
echo "📦 Preparing GitHub Pages assets..."

# .nojekyll ensures GitHub Pages serves raw files without Jekyll ignoring directories
touch dist/.nojekyll

# 404.html ensures client-side SPA routing loads index.html on deep links
cp dist/index.html dist/404.html

# Verify WebAssembly SQLite and Version descriptor exist
if [ -f "dist/sql-wasm.wasm" ]; then
  echo "  ✅ SQLite WebAssembly binary present (dist/sql-wasm.wasm)"
fi
if [ -f "dist/version.json" ]; then
  echo "  ✅ Release version descriptor present (dist/version.json)"
fi

# Step 5: Isolated zero-leak git deployment
echo "🚀 Deploying strictly compiled dist/ to $TARGET_REPO ($TARGET_BRANCH)..."

DEPLOY_TMP=$(mktemp -d)
trap 'rm -rf "$DEPLOY_TMP"' EXIT

# Copy ONLY dist contents into isolated directory (zero source code transfer)
cp -r dist/* "$DEPLOY_TMP/"
cp dist/.nojekyll "$DEPLOY_TMP/"

cd "$DEPLOY_TMP"

git init -q
git checkout -b "$TARGET_BRANCH"
git config user.name "Krish Patel"
git config user.email "Tablenovo1411@gmail.com"

git add -A
COMMIT_TIME=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
git commit -m "deploy(web): LifeLog v1.0.0 sovereign web release ($COMMIT_TIME) [skip ci]" -q

echo "📡 Pushing to $TARGET_REPO ($TARGET_BRANCH)..."
git remote add origin "$TARGET_REPO"

# Try SSH push; if SSH fails, notify with instructions
if git push -f origin "$TARGET_BRANCH"; then
  echo ""
  echo "======================================================================"
  echo "  ✅ Successfully deployed LifeLog Web to GitHub Pages!"
  echo "  🌐 Live Application: $PUBLIC_URL"
  echo "  ⚙️ Note: If this is your first deploy, ensure GitHub Pages is enabled:"
  echo "     1. Open https://github.com/Krrish1411/Lifelog-Releases/settings/pages"
  echo "     2. Under 'Build and deployment > Source', choose 'Deploy from a branch'"
  echo "     3. Select branch: '$TARGET_BRANCH' / folder: '/ (root)' and Save"
  echo "======================================================================"
else
  echo ""
  echo "⚠️ Push to $TARGET_REPO failed. If SSH key is not active, you can deploy using HTTPS:"
  echo "   TARGET_REPO=https://github.com/Krrish1411/Lifelog-Releases.git bash scripts/deploy-release-web.sh $TARGET_BRANCH"
  exit 1
fi
