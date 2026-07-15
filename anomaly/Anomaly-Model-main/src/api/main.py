"""Microserviço FastAPI de detecção de anomalia — Forzy Digital Twin.

Espelha o padrão do serviço de OCR do Forzy (``ocr/OCR-Model-main/src/api/main.py``):
serviço Python/FastAPI independente, consumido pelo frontend via HTTP.

Usa **um único modelo** pré-treinado (``models/baseline.joblib``, gerado por ``train_baseline.py``)
para pontuar qualquer ativo.

Endpoints:
    GET  /health          -> status do serviço e do modelo
    POST /anomaly/score   -> pontua uma janela de leituras e devolve saúde + insight
"""
from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .. import __version__
from ..config import CORS_ORIGINS
from ..data_loader import readings_to_frame
from ..model.baseline import score_health
from ..model.insight import build_insight
from ..model.persistence import baseline_exists, load_baseline
from ..schemas import HealthResponse, ScoreRequest, ScoreResponse

app = FastAPI(
    title="Forzy — Serviço de Anomalia de Ativos",
    description="Detecção de anomalia não supervisionada e Índice de Saúde, com modelo único pré-treinado.",
    version=__version__,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache do modelo carregado (carregado sob demanda na primeira requisição).
_baseline: Optional[dict] = None


def get_baseline() -> dict:
    """Carrega e memoiza o modelo único. Lança FileNotFoundError se não treinado."""
    global _baseline
    if _baseline is None:
        _baseline = load_baseline()
    return _baseline


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    trained_at = None
    if baseline_exists():
        try:
            trained_at = get_baseline().get("trained_at")
        except Exception:  # pragma: no cover - arquivo corrompido
            pass
    return HealthResponse(
        status="ok",
        service="anomaly-model",
        version=__version__,
        model_loaded=baseline_exists(),
        model_trained_at=trained_at,
    )


@app.post("/anomaly/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    """Pontua uma janela de leituras recentes de um ativo com o modelo único."""
    try:
        baseline = get_baseline()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    try:
        df = readings_to_frame([r.model_dump() for r in req.readings])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    result = score_health(df, baseline)
    insight = build_insight(result, baseline)

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
        insight=insight,
        thermal_residual=thermal_residual,
        sustained=result["sustained"],
    )
