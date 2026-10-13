#!/usr/bin/env bash
set -euo pipefail

# Resolve the project directory even when invoked from the repository root.
cd "$(dirname "$0")"
exec python -m gunicorn core.wsgi:application --bind "0.0.0.0:${PORT:-8000}" --access-logfile - --error-logfile -
