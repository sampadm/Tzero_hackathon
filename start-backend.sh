#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/backend"
echo "Starting Tzero BYOA backend on http://localhost:8000 ..."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
