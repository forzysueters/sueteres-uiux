"""Avaliador da frota: o classificador supervisionado diagnosticando a planta de verdade.

A cada ciclo lê do Supabase a janela de 5 min de cada ativo ativo (``model_scoring_window``),
classifica com ``models/classifier.joblib`` e publica o diagnóstico (``publish_model_score``).
Enquanto este processo publica, o avaliador em SQL da migração 0018 fica em espera para o
ativo; se o worker parar, ele reassume sozinho depois de 7 minutos.

    python -m src.worker            # laço contínuo (padrão 300 s)
    python -m src.worker --once     # um ciclo, útil para validar

Variáveis: ``SUPABASE_URL`` e ``SUPABASE_SECRET_KEY`` (ou ``SUPABASE_SERVICE_ROLE_KEY``).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Optional

os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")

import pandas as pd  # noqa: E402

from .config import MODELS_DIR
from .model.classifier import classify_window, frame_to_window, insight_for, load_classifier

INTERVAL = int(os.getenv("ANOMALY_WORKER_INTERVAL", "300"))


def _env(*names: str) -> Optional[str]:
    for n in names:
        if os.getenv(n):
            return os.getenv(n)
    return None


class Supabase:
    def __init__(self, url: str, key: str):
        self.base = url.rstrip("/") + "/rest/v1/rpc/"
        self.headers = {"apikey": key, "Content-Type": "application/json"}
        if key.startswith("eyJ"):  # service_role legado (JWT)
            self.headers["Authorization"] = f"Bearer {key}"

    def rpc(self, fn: str, payload: dict):
        req = urllib.request.Request(
            self.base + fn, data=json.dumps(payload).encode(), headers=self.headers, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = resp.read()
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"{fn}: HTTP {exc.code} {exc.read()[:300]!r}") from exc
        return json.loads(body) if body else None


def channel_of(sensor: dict) -> Optional[str]:
    if sensor["sensor_type"] == "temperature":
        return "temperature"
    if sensor["sensor_type"] == "vibration":
        unit = (sensor.get("unit") or "").lower()
        if unit == "mm/s" or "velocidade" in sensor["name"].lower():
            return "velocity"
        if "m/s" in unit or "acelera" in sensor["name"].lower():
            return "acceleration"
    return None


def score_asset(asset: dict, model: dict) -> Optional[dict]:
    series, limits, sensor_by_channel = {}, {}, {}
    for s in asset.get("sensors") or []:
        ch = channel_of(s)
        if ch is None or ch in series or not s.get("readings"):
            continue
        ts, values = zip(*s["readings"])
        series[ch] = pd.Series(values, index=pd.to_datetime(list(ts), utc=True), dtype=float)
        limits[ch] = {"warn": s["warn"], "crit": s["crit"], "direction": s.get("direction") or "above"}
        sensor_by_channel[ch] = s["sensor_id"]
    if not series:
        return None

    df = pd.DataFrame(series).sort_index()
    window = frame_to_window(df, limits)
    result = classify_window(window, model)
    worst = max(result["channel_penalty"], key=lambda c: result["channel_penalty"][c]
                if c in sensor_by_channel else -1)
    return {
        "p_asset_id": asset["asset_id"],
        "p_health": round(result["health_index"], 2),
        "p_severity": result["severity"],
        "p_confidence": round(result["confidence"], 4),
        "p_insight": insight_for(result),
        "p_worst_sensor": sensor_by_channel.get(worst),
        "p_features": {
            "probabilities": {k: round(v, 4) for k, v in result["probabilities"].items()},
            "anomaly_penalty": round(result["anomaly_penalty"], 4),
            "thermal_penalty": round(result["thermal_penalty"], 4),
            "channel_penalty": {k: round(v, 4) for k, v in result["channel_penalty"].items()},
            "points": result["points"],
            "model_version": model.get("version"),
        },
    }


def cycle(db: Supabase, model: dict) -> int:
    assets = db.rpc("model_scoring_window", {"p_minutes": 5}) or []
    published = 0
    for asset in assets:
        payload = score_asset(asset, model)
        if payload is None:
            continue
        db.rpc("publish_model_score", payload)
        published += 1
        print(f"  {asset['tag']:<8} {payload['p_severity']:<8} saúde {payload['p_health']:5.1f} "
              f"conf {payload['p_confidence']:.3f}", flush=True)
    return published


def register(db: Supabase) -> None:
    card = MODELS_DIR / "model_card.json"
    if card.exists():
        db.rpc("register_model_version", {"p_card": json.loads(card.read_text(encoding="utf-8"))})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()

    url = _env("SUPABASE_URL", "VITE_SUPABASE_URL")
    key = _env("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Defina SUPABASE_URL e SUPABASE_SECRET_KEY.", file=sys.stderr)
        return 1

    db = Supabase(url, key)
    model = load_classifier()
    register(db)
    print(f"Classificador {model.get('version')} carregado; ciclo de {INTERVAL}s.", flush=True)

    while True:
        started = time.time()
        try:
            n = cycle(db, model)
            print(f"[{time.strftime('%H:%M:%S')}] {n} ativos publicados", flush=True)
        except Exception as exc:  # o laço não pode morrer por uma falha de rede
            print(f"[{time.strftime('%H:%M:%S')}] falha no ciclo: {exc}", file=sys.stderr, flush=True)
            if args.once:
                return 1
        if args.once:
            return 0
        time.sleep(max(5, INTERVAL - (time.time() - started)))


if __name__ == "__main__":
    raise SystemExit(main())
