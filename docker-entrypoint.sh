#!/bin/sh
set -eu

: "${PORT:=80}"
: "${BACKEND_HOSTPORT:=backend:8787}"

envsubst '${PORT} ${BACKEND_HOSTPORT}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec "$@"
