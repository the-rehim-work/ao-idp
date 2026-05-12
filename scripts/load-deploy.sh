#!/bin/bash
set -e

echo ">>> Loading image ..."
docker load -i ./ao-idp-server.tar

echo ">>> Ensuring ao-network exists ..."
docker network inspect ao-network >/dev/null 2>&1 || docker network create ao-network

echo ">>> Preparing data directory ..."
sudo mkdir -p /opt/ao-idp/postgres

echo ">>> Starting service ..."
docker compose up -d

echo ""
echo "Done. Application is running at http://localhost:7000"
echo "Admin panel: http://localhost:7000/admin"
echo ""
echo "Nginx can proxy to container 'ao-idp' on the 'ao-network' network."
echo "nginx config: proxy_pass http://ao-idp:7000;"
