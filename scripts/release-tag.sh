#!/usr/bin/env bash
set -euo pipefail

git fetch origin master
git checkout master
git pull origin master

VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"
MESSAGE="chore(release): ${VERSION}"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists."
  exit 0
fi

git tag -a "${TAG}" -m "${MESSAGE}"
git push "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "${TAG}"
