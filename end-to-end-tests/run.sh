#!/usr/bin/env bash

ROOT="$(dirname $0)/.."
rm ~/.dev-ssl-certs/localhost.*

node "$ROOT/dist/src/cli.js" start "$ROOT/end-to-end-tests/proxy-config.ts" &
PROXY_PID=$!

"$ROOT/node_modules/.bin/http-server" -s -p 3009 . &
HTTP_SERVER_PID=$!

control_c()
{
  kill -s INT $PROXY_PID
  kill -s INT $HTTP_SERVER_PID
  wait $HTTP_SERVER_PID
  wait $PROXY_PID
  exit 0
}

trap control_c SIGINT

sleep 2
timeout 60 bash -c 'while [[ "$(curl -s -k -o /dev/null -w ''%{http_code}'' https://intervene-test.bruderstein.vercel.app/proxyhealth)" != "200" ]]; do sleep 1; done' || false

echo "Now open your browser (chrome or safari) at http://localhost:3009/end-to-end-tests/index.html"
echo "Press ctrl-C when done"

read -r -d '' _ < /dev/tty
