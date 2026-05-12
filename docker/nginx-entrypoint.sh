#!/bin/sh
set -e

apk add --no-cache openssl > /dev/null 2>&1

mkdir -p /etc/nginx/certs

if [ ! -f /etc/nginx/certs/cert.pem ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/certs/key.pem \
        -out    /etc/nginx/certs/cert.pem \
        -subj   "/CN=localhost/O=AO-IDP" \
        > /dev/null 2>&1
    echo "[nginx-entrypoint] Self-signed cert generated."
fi

exec nginx -g "daemon off;"
