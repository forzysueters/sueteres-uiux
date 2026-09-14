"""Classificador supervisionado de severidade e regressor do Índice de Saúde.

Opera sobre janelas de 5 min na escala normativa (``normative.py``), então o mesmo modelo
serve a qualquer ativo que tenha limites cadastrados — o que o baseline em unidade bruta
não conseguia (ver "Limitações" no README).
"""
from __future__ import annotations

import warnings
from datetime import datetime
from pathlib import Path
from typing import Mapping, Optional

import joblib
import numpy as np
import pandas as pd

from ..config import CRIT_LEVEL, HEALTH_OK, MODELS_DIR, RESAMPLE_RULE, WARN_LEVEL
from .augment import WINDOW
from .normative import CHANNELS, SEVERITIES, channel_penalty, to_positions

DEFAULT_CLASSIFIER_PATH: Path = MODELS_DIR / "classifier.joblib"

_STATS = ("mean", "max", "min", "std", "p90", "last", "slope", "frac_warn", "frac_crit", "present")
FEATURE_NAMES = [f"{ch}_{s}" for ch in CHANNELS for s in _STATS] + ["vibration_max", "all_max"]

_MISSING = -3.0
_HEALTH_BANDS = {0: (HEALTH_OK, 100.0), 1: (WARN_LEVEL, HEALTH_OK - 0.01),
                 2: (CRIT_LEVEL, WARN_LEVEL - 0.01), 3: (0.0, CRIT_LEVEL - 0.01)}


def window_features(windows: np.ndarray) -> np.ndarray:
    """Atributos por janela ``(n, pontos, 3)`` → ``(n, len(FEATURE_NAMES))``."""
    n, points, _ = windows.shape
    x = np.arange(points) - (points - 1) / 2
    cols = []
    with np.errstate(all="ignore"), warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        for j in range(len(CHANNELS)):
            w = windows[:, :, j]
            present = ~np.all(np.isnan(w), axis=1)
            filled = np.where(np.isnan(w), np.nanmean(w, axis=1, keepdims=True), w)
            slope = (filled * x).sum(axis=1) / (x ** 2).sum()
            stats = [
                np.nanmean(w, axis=1), np.nanmax(w, axis=1), np.nanmin(w, axis=1),
                np.nanstd(w, axis=1), np.nanpercentile(w, 90, axis=1), filled[:, -1], slope,
                np.nanmean(w >= 0, axis=1), np.nanmean(w >= 1, axis=1),
            ]
            for s in stats:
                cols.append(np.where(present, s, _MISSING))
            cols.append(present.astype(float))
        vib = np.nanmax(windows[:, :, :2], axis=(1, 2))
        allm = np.nanmax(windows, axis=(1, 2))
    cols.append(np.nan_to_num(vib, nan=_MISSING))
    cols.append(np.nan_to_num(allm, nan=_MISSING))
    return np.nan_to_num(np.column_stack(cols), nan=_MISSING)


def save_classifier(model: dict, path: Path = DEFAULT_CLASSIFIER_PATH) -> Path:
    joblib.dump(model, path)
    return path


def load_classifier(path: Path = DEFAULT_CLASSIFIER_PATH) -> dict:
    if not path.exists():
        raise FileNotFoundError(
            f"Classificador não encontrado em {path}. Rode `python train_classifier.py`."
        )
    return joblib.load(path)


def classifier_exists(path: Path = DEFAULT_CLASSIFIER_PATH) -> bool:
    return path.exists()


def rul_days(health: float) -> int:
    """Mesma lei de potência de ``public.synthetic_score``: ~6 d crítico, ~355 d normal."""
    return int(min(400, max(1, round(health ** 3.5 / 19317.0))))


def frame_to_window(df: pd.DataFrame, limits: Mapping[str, Mapping]) -> np.ndarray:
    r = df.resample(RESAMPLE_RULE).mean().interpolate(limit=6).ffill().bfill()
    r = r.iloc[-WINDOW:]
    series = {c: r[c].to_numpy() for c in r.columns if c in CHANNELS}
    return to_positions(series, limits, length=len(r))


def classify_window(window: np.ndarray, model: dict) -> dict:
    """Diagnóstico de uma janela ``(pontos, 3)`` em escala normativa."""
    feats = window_features(window[None, :, :])
    proba = model["classifier"].predict_proba(feats)[0]
    classes = list(model["classifier"].classes_)
    probs = {SEVERITIES[c]: float(p) for c, p in zip(classes, proba)}
    cls = int(classes[int(np.argmax(proba))])

    # O número do gauge não pode contradizer a severidade: a saúde prevista fica dentro
    # da faixa da classe escolhida.
    lo, hi = _HEALTH_BANDS[cls]
    health = float(np.clip(model["regressor"].predict(feats)[0], lo, hi))

    with np.errstate(all="ignore"), warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        pen = np.nan_to_num(np.nanmax(channel_penalty(window), axis=0), nan=0.0)
    return {
        "severity": SEVERITIES[cls],
        "health_index": health,
        "probabilities": probs,
        "confidence": float(np.max(proba)),
        "anomaly_penalty": float(max(pen[0], pen[1])),
        "thermal_penalty": float(pen[2]),
        "channel_penalty": {ch: float(p) for ch, p in zip(CHANNELS, pen)},
        "rul_days": rul_days(health),
        "points": int(np.sum(~np.all(np.isnan(window), axis=1))),
    }


_ACAO = {
    "ok": "Nenhuma ação necessária.",
    "info": "Acompanhar nas próximas leituras.",
    "alerta": "Agendar inspeção preventiva.",
    "critico": "Acionar a manutenção com prioridade.",
}
_PREFIXO = {"critico": "Degradação crítica", "alerta": "Desvio relevante",
            "info": "Desvio leve", "ok": "Desvio pontual"}


def action_for(severity: str) -> str:
    return _ACAO[severity]


def insight_for(result: dict) -> str:
    """Mesmo formato do insight da 0018 e de ``insight.py``, para a tela não mudar de voz."""
    sev, health = result["severity"], result["health_index"]
    reasons = []
    if result["thermal_penalty"] > 0.08:
        reasons.append("resíduo térmico acima do esperado para a carga (aquecimento não explicado)")
    if result["anomaly_penalty"] > 0.08:
        reasons.append("padrão de operação atípico frente à linha de base saudável")
    if sev == "ok" and not reasons:
        return (f"Operação dentro do padrão (saúde {health:.0f}/100). "
                "Nenhum desvio relevante detectado.")
    motivo = "; ".join(reasons) if reasons else "leve desvio em relação à linha de base"
    return f"{_PREFIXO[sev]} (saúde {health:.0f}/100): {motivo}. {_ACAO[sev]}"


def model_summary(model: Optional[dict]) -> Optional[dict]:
    if model is None:
        return None
    trained = model.get("trained_at")
    return {
        "version": model.get("version"),
        "trained_at": trained.isoformat() if isinstance(trained, datetime) else trained,
        "metrics": model.get("metrics"),
    }
