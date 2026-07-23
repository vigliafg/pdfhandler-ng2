#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SESSION="pdfhandler-responsive"
PORT=5174

echo "🚀 Avvio pdfhandler-responsive su porta $PORT..."

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Kill any process on the port
fuser -k "$PORT/tcp" 2>/dev/null || true

# Start a new detached tmux session running the vite dev server
tmux new-session -d -s "$SESSION" -c "$PROJECT_DIR" \
  "npx vite --config vite-responsive.config.ts --host 0.0.0.0 2>&1"

echo "✅ Server avviato nella sessione tmux '$SESSION'"
echo "   URL: http://localhost:$PORT"
echo ""
echo "Comandi utili:"
echo "  tmux attach -t $SESSION   # vedi i log del server"
echo "  tmux kill-session -t $SESSION  # ferma il server"
