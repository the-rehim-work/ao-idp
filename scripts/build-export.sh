#!/bin/bash
set -e

EXPORT_DIR="./export"
mkdir -p "$EXPORT_DIR"

echo ">>> Building ao-images/ao-idp-server:latest ..."
docker build -t ao-images/ao-idp-server:latest .

echo ">>> Saving image to $EXPORT_DIR ..."
docker save ao-images/ao-idp-server:latest -o "$EXPORT_DIR/ao-idp-server.tar"

echo ""
echo "Done. Copy these files to USB:"
echo "  $EXPORT_DIR/ao-idp-server.tar"
echo "  docker-compose.yml"
echo "  .env"
echo "  scripts/load-deploy.sh"
