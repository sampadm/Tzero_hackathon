#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/frontend"
echo "Starting Tzero BYOA frontend on http://localhost:3000 ..."
npm run dev
