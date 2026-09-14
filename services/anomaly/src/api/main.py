"""Microserviço FastAPI de diagnóstico de ativos — Forzy Digital Twin.

Dois modelos pré-treinados:

- ``models/classifier.joblib`` (``train_classifier.py``): classificador supervisionado de
  severidade + regressor do Índice de Saúde, na escala normativa. É o que a planta usa —
  exige os limites de cada canal no request.
- ``models/baseline.joblib`` (``train_baseline.py``): detector não supervisionado em unidade
  bruta, mantido para janelas sem limites cadastrados.

Endpoints:
    GET  /health          -> status do serviço e dos modelos
    GET  /model           -> model card do classificador
    POST /anomaly/score   -> pontua uma janela de leituras e devolve saúde + insight
"""
from __future__ import annotations

import json
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .. import __version__
from ..config import CORS_ORIGINS, MODELS_DIR
from ..data_loader import readings_to_frame
from ..model.baseline import score_health
from ..model.classifier import (
    classifier_exists,
    classify_window,
    frame_to_window,
    insight_for,
    load_classifier,
)
from ..model.insight import build_insight
from ..model.persistence import baseline_exists, load_baseline
from ..schemas import HealthResponse, ScoreRequest, ScoreResponse

app = FastAPI(
    title="Forzy — Serviço de Diagnóstico de Ativos",
    description="Classificador supervisionado de severidade e detector de anomalia não supervisionado.",
    version=__version__,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_baseline: Optional[dict] = None
_classifier: Optional[dict] = None


def get_baseline() -> dict:
    global _baseline
    if _baseline is None:
        _baseline = load_baseline()
    return _baseline


def get_classifier() -> dict:
    global _classifier
    if _classifier is None:
        _classifier = load_classifier()
    return _classifier


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    trained_at = None
    if baseline_exists():
        try:
            trained_at = get_baseline().get("trained_at")
        except Exception:  # pragma: no cover - arquivo corrompido
            pass
    classifier_version = None
    if classifier_exists():
        try:
            classifier_version = get_classifier().get("version")
        except Exception:  # pragma: no cover
            pass
    return HealthResponse(
        status="ok",
        service="anomaly-model",
        version=__version__,
        model_loaded=baseline_exists(),
        model_trained_at=trained_at,
        classifier_loaded=classifier_version is not None,
        classifier_version=classifier_version,
    )


@app.get("/model")
def model_card() -> dict:
    path = MODELS_DIR / "model_card.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="model_card.json não gerado.")
    return json.loads(path.read_text(encoding="utf-8"))


@app.post("/anomaly/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    try:
        df = readings_to_frame([r.model_dump() for r in req.readings])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if req.limits:
        return _score_with_classifier(req, df)
    return _score_with_baseline(req, df)


def _score_with_classifier(req: ScoreRequest, df) -> ScoreResponse:
    try:
        model = get_classifier()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    limits = {ch: lim.model_dump() for ch, lim in req.limits.items()}
    window = frame_to_window(df, limits)
    if window.size == 0 or not (window == window).any():
        raise HTTPException(status_code=422, detail="Nenhum canal das leituras tem limite informado.")

    result = classify_window(window, model)
    return ScoreResponse(
        asset_tag=req.asset_tag,
        timestamp=df.index[-1].to_pydatetime(),
        health_index=round(result["health_index"], 1),
        health_min=round(result["health_index"], 1),
        anomaly_score=round(1 - result["health_index"] / 100, 3),
        severity=result["severity"],
        insight=insight_for(result),
        thermal_residual=None,
        sustained=result["severity"] in ("alerta", "critico") and result["points"] >= 18,
        model_used="classifier",
        model_version=model.get("version"),
        probabilities={k: round(v, 4) for k, v in result["probabilities"].items()},
        confidence=round(result["confidence"], 4),
        rul_days=result["rul_days"],
    )


def _score_with_baseline(req: ScoreRequest, df) -> ScoreResponse:
    try:
        baseline = get_baseline()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    result = score_health(df, baseline)
    thermal_residual = None
    if baseline.get("thermal") is not None and len(result["residuals"]):
        thermal_residual = round(float(result["residuals"].iloc[-1]), 3)

    return ScoreResponse(
        asset_tag=req.asset_tag,
        timestamp=result["timestamp"],
        health_index=round(result["health_index"], 1),
        health_min=round(result["health_min"], 1),
        anomaly_score=round(result["anomaly_score"], 3),
        severity=result["severity"],
        insight=build_insight(result, baseline),
        thermal_residual=thermal_residual,
        sustained=result["sustained"],
        model_used="baseline",
        model_version=baseline.get("model_version"),
    )
