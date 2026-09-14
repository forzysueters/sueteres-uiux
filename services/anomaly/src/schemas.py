"""Contratos de request/response da API (Pydantic), alinhados ao frontend do Forzy."""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class Reading(BaseModel):
    """Uma amostra de sensores de um ativo num instante."""
    timestamp: datetime
    sensors: Dict[str, float] = Field(
        ...,
        description="Canais numéricos, ex.: {'velocity': 6.8, 'acceleration': 0.04, 'temperature': 47}",
    )


class ChannelLimit(BaseModel):
    warn: float
    crit: float
    direction: Literal["above", "below"] = "above"


class ScoreRequest(BaseModel):
    asset_tag: Optional[str] = Field(
        None,
        description="TAG do ativo, apenas para rótulo/eco na resposta (o modelo é único e compartilhado).",
        examples=["MTR-001"],
    )
    readings: List[Reading] = Field(
        ...,
        min_length=1,
        description="Janela de leituras recentes (ex.: últimos 10-30 min) do ativo.",
    )
    limits: Optional[Dict[str, ChannelLimit]] = Field(
        None,
        description="Limites de alerta/crítico por canal. Com eles, o diagnóstico sai do "
                    "classificador supervisionado; sem eles, do baseline não supervisionado.",
    )


class ScoreResponse(BaseModel):
    asset_tag: Optional[str]
    timestamp: datetime
    health_index: float = Field(..., description="Índice de Saúde 0-100 no instante atual (para o gauge)")
    health_min: float = Field(..., description="Pior Índice de Saúde na janela avaliada (justifica a severidade)")
    anomaly_score: float = Field(..., description="Score de anomalia 0-1 no ponto atual")
    severity: str = Field(..., description="ok | info | alerta | critico")
    insight: str = Field(..., description="Texto de insight preditivo acionável")
    thermal_residual: Optional[float] = Field(
        None, description="Resíduo térmico atual (real - esperado), °C, se houver modelo térmico"
    )
    sustained: bool = Field(..., description="Desvio sustentado abaixo do limiar de atenção")
    model_used: Literal["classifier", "baseline"] = "baseline"
    model_version: Optional[str] = None
    probabilities: Optional[Dict[str, float]] = None
    confidence: Optional[float] = None
    rul_days: Optional[int] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    model_loaded: bool
    model_trained_at: Optional[str] = None
    classifier_loaded: bool = False
    classifier_version: Optional[str] = None
