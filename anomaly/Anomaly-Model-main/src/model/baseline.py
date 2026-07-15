"""Treino da linha de base saudável e scoring do Índice de Saúde, por ativo.

Refatorado das células `fit_baseline`/`score`/`maintenance_logic` do notebook.
A matemática de detecção é preservada:
- Isolation Forest sobre os atributos de operação (ponto atípico).
- Modelo térmico Ridge: temperatura esperada dada a carga; o resíduo (real - esperado)
  sinaliza aquecimento não explicado.
- Penalidade combinada por "OR probabilístico" e Índice de Saúde 0-100 suavizado (EWM).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Union

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

from .. import __version__
from ..config import (
    CRIT_LEVEL,
    FEATURE_WIN,
    HEALTH_EWM_ALPHA,
    HEALTH_OK,
    PERSIST_SAMPLES,
    RESAMPLE_RULE,
    WARN_LEVEL,
)
from .features import (
    TEMP_CHANNEL,
    build_features,
    has_thermal,
    resample,
    thermal_features,
)

# Severidades alinhadas ao contrato do frontend do Forzy.
SEVERITY_OK = "ok"
SEVERITY_INFO = "info"
SEVERITY_ALERTA = "alerta"
SEVERITY_CRITICO = "critico"


def fit_baseline(
    data: Union[pd.DataFrame, List[pd.DataFrame]],
    label: str = "baseline",
    resample_rule: str = RESAMPLE_RULE,
    win: int = FEATURE_WIN,
) -> dict:
    """Aprende o comportamento normal de operação a partir de dados assumidos saudáveis.

    ``data`` é um frame (índice = timestamp, colunas = canais) ou uma **lista de segmentos**
    independentes (ex.: os dois motores do CSV, ou várias sessões saudáveis). Cada segmento é
    reamostrado e transformado em atributos separadamente — as janelas móveis não cruzam a
    fronteira entre segmentos — e os atributos resultantes são empilhados como exemplos normais.
    """
    segments = data if isinstance(data, list) else [data]

    feat_frames: list[pd.DataFrame] = []
    thermal_X: list[pd.DataFrame] = []
    thermal_y: list[pd.Series] = []
    channels: set[str] = set()
    for df in segments:
        r = resample(df, resample_rule)
        feat_frames.append(build_features(r, win))
        channels.update(r.columns)
        if has_thermal(r):
            thermal_X.append(thermal_features(r))
            thermal_y.append(r[TEMP_CHANNEL])

    # Alinha colunas entre segmentos (união) e empilha os exemplos normais.
    f = pd.concat(feat_frames).fillna(0)

    scaler = StandardScaler().fit(f)
    iso = IsolationForest(n_estimators=300, random_state=42).fit(scaler.transform(f))
    score = -iso.score_samples(scaler.transform(f))

    thermal: Optional[Ridge] = None
    rstd = 1e-6
    if thermal_X:
        tX = pd.concat(thermal_X)
        ty = pd.concat(thermal_y)
        thermal = Ridge(alpha=1.0).fit(tX, ty)
        resid = (ty - thermal.predict(tX)).abs()
        rstd = float(resid.std() + 1e-6)

    cal = {
        "ref": float(np.percentile(score, 99.6)),  # fronteira do normal
        "smax": float(score.max()),
        "rstd": rstd,
        "cols": list(f.columns),
    }

    return {
        "label": label,
        "scaler": scaler,
        "iso": iso,
        "thermal": thermal,
        "temp_channel": TEMP_CHANNEL if thermal is not None else None,
        "channels": sorted(channels),
        "n_segments": len(segments),
        "cal": cal,
        "resample_rule": resample_rule,
        "win": win,
        "n_samples": int(len(f)),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "model_version": __version__,
    }


_SEVERITY_ORDER = [SEVERITY_OK, SEVERITY_INFO, SEVERITY_ALERTA, SEVERITY_CRITICO]


def _worse(a: str, b: str) -> str:
    """Retorna a severidade mais grave entre duas."""
    return max(a, b, key=_SEVERITY_ORDER.index)


def _severity_from_health(health: float) -> str:
    """Mapeia o índice de saúde (0-100) para a severidade do frontend."""
    if health < CRIT_LEVEL:
        return SEVERITY_CRITICO
    if health < WARN_LEVEL:
        return SEVERITY_ALERTA
    if health < HEALTH_OK:
        return SEVERITY_INFO
    return SEVERITY_OK


def score_health(df: pd.DataFrame, baseline: dict) -> dict:
    """Aplica o baseline a dados novos e devolve o diagnóstico do ativo.

    Retorna um dicionário com séries (para gráficos) e um resumo do ponto mais recente.
    """
    rule = baseline.get("resample_rule", RESAMPLE_RULE)
    win = baseline.get("win", FEATURE_WIN)
    r = resample(df, rule)
    f = build_features(r, win).reindex(columns=baseline["cal"]["cols"], fill_value=0)

    cal = baseline["cal"]
    sc = -baseline["iso"].score_samples(baseline["scaler"].transform(f))
    s_pen = np.clip((sc - cal["ref"]) / (cal["smax"] - cal["ref"] + 1e-9), 0, 1)

    temp_channel = baseline.get("temp_channel")
    if baseline.get("thermal") is not None and temp_channel in r.columns:
        tf = thermal_features(r)
        residuals = r[temp_channel] - baseline["thermal"].predict(tf)
        rmax = residuals.abs().values
        r_pen = np.clip((rmax - 3 * cal["rstd"]) / (4 * cal["rstd"]), 0, 1)  # >3σ penaliza
    else:
        residuals = pd.Series(0.0, index=r.index)
        r_pen = np.zeros(len(f))

    penalty = 1 - (1 - s_pen) * (1 - r_pen)  # OR probabilístico
    health = pd.Series(100 * (1 - penalty), index=r.index).ewm(alpha=HEALTH_EWM_ALPHA).mean()

    current = float(health.iloc[-1])
    health_min = float(health.min())
    sustained = _sustained_below_warn(health)
    severity = _severity_from_health(current)
    # Se houve queda sustentada na janela, a severidade reflete o pior estado (health_min),
    # mesmo que o instante atual já tenha se recuperado — condição de alerta ativa.
    if sustained:
        severity = _worse(severity, _severity_from_health(health_min))

    return {
        "resampled": r,
        "residuals": residuals,
        "health": health,
        "anomaly_score": float(s_pen[-1]),          # 0..1 no ponto atual
        "thermal_penalty": float(r_pen[-1]),        # 0..1 no ponto atual
        "health_index": current,
        "health_min": health_min,
        "severity": severity,
        "sustained": sustained,
        "timestamp": r.index[-1].to_pydatetime(),
    }


def _sustained_below_warn(health: pd.Series, persist: int = PERSIST_SAMPLES) -> bool:
    """True se a saúde ficou abaixo do warn por >= ``persist`` amostras consecutivas
    em qualquer momento da janela (mesma lógica de ``maintenance_logic`` do notebook)."""
    run = 0
    for h in health.values:
        run = run + 1 if h < WARN_LEVEL else 0
        if run >= persist:
            return True
    return False
