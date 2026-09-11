#!/bin/bash

# Sobe o frontend e os serviços de modelo (OCR e anomalia).
# Não há backend de aplicação: dados e autenticação vêm do Supabase.

PIDS=()

# ─── Modelo de OCR (FastAPI, porta 8000) ────────────────────────────────────
if [ -x "services/ocr/.venv/bin/python" ]; then
  echo "🚀 Iniciando modelo de OCR..."
  ( cd services/ocr && PYTHONUTF8=1 .venv/bin/python -m uvicorn src.api.main:app --port 8000 ) &
  PIDS+=($!)
else
  echo "⚠️  Modelo de OCR não configurado. Veja docs/OCR_INTEGRATION.md (o front usa mock)."
fi

# ─── Modelo de anomalia (FastAPI, porta 8001) ───────────────────────────────
if [ -x "services/anomaly/.venv/bin/python" ]; then
  echo "🚀 Iniciando modelo de anomalia..."
  ( cd services/anomaly && PYTHONUTF8=1 .venv/bin/python -m uvicorn src.api.main:app --port 8001 ) &
  PIDS+=($!)
else
  echo "⚠️  Modelo de anomalia não configurado (o front usa mock)."
fi

sleep 2

# ─── Frontend ───────────────────────────────────────────────────────────────
echo "🚀 Iniciando frontend..."
npm run dev &
PIDS+=($!)

echo ""
echo "✅ Tudo no ar!"
echo ""
echo "📍 Frontend:          http://localhost:5173"
echo "📍 Modelo de OCR:     http://localhost:8000"
echo "📍 Modelo de anomalia: http://localhost:8001"
echo "📍 Banco e auth:      Supabase (VITE_SUPABASE_URL no .env)"
echo ""
echo "Ctrl+C para parar."
echo ""

wait "${PIDS[@]}"
