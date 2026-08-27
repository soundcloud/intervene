#!/usr/bin/env bash
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "GitHub release ${TAG} already exists."
  exit 0
fi

NOTES=$(awk -v version="$VERSION" '
  index($0, "## [" version "]") == 1 || index($0, "# [" version "]") == 1 { capture=1; next }
  capture && /^##? / { exit }
  capture { print }
' CHANGELOG.md)

gh release create "$TAG" --notes "$NOTES"
