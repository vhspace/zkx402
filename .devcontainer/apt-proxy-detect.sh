#!/usr/bin/env bash
set -euo pipefail

# APT cache via apt-cacher-ng on the host (macOS/OrbStack/Docker Desktop).
# Returns a proxy URL if reachable; otherwise returns DIRECT for failover.
HOST="${APT_CACHE_HOST:-host.docker.internal}"
PORT="${APT_CACHE_PORT:-3142}"
URL="http://${HOST}:${PORT}"

if timeout 1 bash -c "echo >/dev/tcp/${HOST}/${PORT}" >/dev/null 2>&1; then
  echo "${URL}"
else
  echo "DIRECT"
fi

