#!/usr/bin/env bash
set -euo pipefail

assets=(CHANGELOG.md package.json package-lock.json)
existing=()
for file in "${assets[@]}"; do
  if [ -e "$file" ]; then
    existing+=("$file")
  fi
done

if [ ${#existing[@]} -eq 0 ]; then
  echo "No release assets found."
  echo "released=false" >> "${GITHUB_OUTPUT:-/dev/null}"
  exit 0
fi

if git diff --quiet HEAD -- "${existing[@]}" 2>/dev/null && \
   [ -z "$(git status --porcelain -- "${existing[@]}")" ]; then
  echo "No release changes to push."
  echo "released=false" >> "${GITHUB_OUTPUT:-/dev/null}"
  exit 0
fi

VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"
MESSAGE="chore(release): ${VERSION}"

git add "${existing[@]}"
git commit -m "${MESSAGE}"
git tag -a "${TAG}" -m "${MESSAGE}"
git push origin HEAD --tags

echo "released=true" >> "${GITHUB_OUTPUT:-/dev/null}"
echo "version=${VERSION}" >> "${GITHUB_OUTPUT:-/dev/null}"
