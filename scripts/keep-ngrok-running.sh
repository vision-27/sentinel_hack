#!/bin/bash
# Keep ngrok running - restarts if it crashes or exits
# Usage: ./scripts/keep-ngrok-running.sh [port]
# Default port: 8787 (ElevenLabs webhooks)

PORT=${1:-8787}

echo "========================================"
echo "  ngrok Keep-Alive Monitor"
echo "  Port: $PORT"
echo "  Press Ctrl+C to stop"
echo "========================================"

while true; do
    if ! pgrep -x ngrok > /dev/null; then
        echo "[$(date '+%H:%M:%S')] Starting ngrok on port $PORT..."
        ngrok http "$PORT" &
        sleep 3
    fi
    sleep 10
done
