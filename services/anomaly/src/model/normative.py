"""Escala normativa comum e rótulo de referência (professor) do classificador.

Cada sensor tem limites em unidades que não se comparam (mm/s, m/s², °C). Tudo aqui
trabalha na posição do valor entre os limites do próprio sensor:

    t = 0  no limite de alerta     t = 1  no limite crítico     t < 0  lado saudável

É a mesma coordenada de ``public.threshold_position`` (migração 0018) e do gauge da tela,
então o modelo, o cenário simulado e a cor exibida nunca contam histórias diferentes.

O rótulo de referência reproduz a regra de ``public.synthetic_score``: penalidade por canal,
combinação por "OR probabilístico" e cortes 85/65/45 de ``config.py``.
"""
from __future__ import annotations

import warnings
from typing import Mapping, Optional

import numpy as np

from ..config import CRIT_LEVEL, HEALTH_OK, WARN_LEVEL

CHANNELS = ("velocity", "acceleration", "temperature")
VIBRATION_CHANNELS = ("velocity", "acceleration")
SEVERITIES = ("ok", "info", "alerta", "critico")


def threshold_position(values, warn: float, crit: float, direction: str = "above") -> np.ndarray:
    v = np.asarray(values, dtype=float)
    if warn == crit:
        return np.full_like(v, np.nan)
    if direction == "below":
        return (warn - v) / (warn - crit)
    return (v - warn) / (crit - warn)


def threshold_value(t, warn: float, crit: float, direction: str = "above") -> np.ndarray:
    t = np.asarray(t, dtype=float)
    if direction == "below":
        return warn - t * (warn - crit)
    return warn + t * (crit - warn)


def channel_penalty(t) -> np.ndarray:
    """Penalidade 0..1 de uma posição normativa (mesma reta da 0018)."""
    return np.clip(0.55 * (0.5 + 0.5 * np.asarray(t, dtype=float) - 0.21), 0.0, 1.0)


def severity_from_health(health) -> np.ndarray:
    h = np.asarray(health, dtype=float)
    return np.select(
        [h >= HEALTH_OK, h >= WARN_LEVEL, h >= CRIT_LEVEL],
        [0, 1, 2],
        default=3,
    )


def teacher(windows: np.ndarray) -> dict:
    """Rótulo de referência de um lote de janelas ``(n, pontos, 3)`` em escala ``t``.

    Canal ausente vem como NaN e não penaliza.
    """
    pen = channel_penalty(windows)
    with np.errstate(all="ignore"), warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        per_channel = np.nanmax(np.where(np.isnan(windows), np.nan, pen), axis=1)
    per_channel = np.nan_to_num(per_channel, nan=0.0)
    s_pen = per_channel[:, :2].max(axis=1)
    r_pen = per_channel[:, 2]
    health = 100.0 * (1 - s_pen) * (1 - r_pen)
    return {
        "health": health,
        "severity": severity_from_health(health),
        "anomaly_penalty": s_pen,
        "thermal_penalty": r_pen,
        "channel_penalty": per_channel,
    }


def to_positions(
    series: Mapping[str, np.ndarray],
    limits: Mapping[str, Mapping],
    length: Optional[int] = None,
) -> np.ndarray:
    """Converte séries brutas por canal numa janela ``(pontos, 3)`` em escala ``t``."""
    n = length or max(len(v) for v in series.values())
    out = np.full((n, len(CHANNELS)), np.nan)
    for j, ch in enumerate(CHANNELS):
        if ch not in series or ch not in limits:
            continue
        lim = limits[ch]
        vals = np.asarray(series[ch], dtype=float)[-n:]
        out[n - len(vals):, j] = threshold_position(
            vals, float(lim["warn"]), float(lim["crit"]), lim.get("direction", "above")
        )
    return out
