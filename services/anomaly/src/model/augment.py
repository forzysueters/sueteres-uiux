"""Data augmentation das janelas de operação.

O único dado medido é o log IO-Link de ~4 h de dois motores saudáveis — nenhuma falha,
nenhum rótulo. O aumento parte dele de três formas:

1. **Janelas reais** do CSV, projetadas na escala normativa com os limites de cada classe
   de máquina da planta (a mesma dinâmica medida, lida sob outro limite ISO).
2. **Dinâmica real reposicionada**: o formato de um recorte do CSV (ciclos liga/desliga,
   inércia térmica) vira a oscilação em torno de um nível de severidade sorteado.
3. **Modos de degradação injetados** sobre essas bases: rampa térmica, deriva de vibração,
   picos intermitentes, perda de amostras, canal ausente e distorção temporal.

Mais o **cenário da planta simulada** (``public.synthetic_tick``), gerado com a mesma
fórmula, para o classificador cobrir exatamente o regime que a tela mostra hoje.
"""
from __future__ import annotations

from typing import Dict, List

import numpy as np
import pandas as pd

from ..config import RESAMPLE_RULE
from .features import resample
from .normative import CHANNELS, threshold_position

WINDOW = 30  # 30 x 10 s = 5 min, a janela do avaliador da 0018

# Classes de limite presentes na planta (tabela `sensors`, migração 0020).
LIMIT_CLASSES: List[Dict[str, dict]] = [
    {  # ISO 10816-3 classe II, 1760 rpm (MTR-001) — também LAB-S1/LAB-S2 na velocidade
        "velocity": {"warn": 4.5, "crit": 7.1},
        "acceleration": {"warn": 0.83, "crit": 1.31},
        "temperature": {"warn": 75, "crit": 90},
    },
    {  # classe I, bomba/exaustor
        "velocity": {"warn": 2.8, "crit": 4.5},
        "acceleration": {"warn": 0.43, "crit": 0.68},
        "temperature": {"warn": 70, "crit": 85},
    },
    {  # pontos do Forzy Lab (aceleração com limite provisório 10/20)
        "velocity": {"warn": 4.5, "crit": 7.1},
        "acceleration": {"warn": 10, "crit": 20},
        "temperature": {"warn": 75, "crit": 90},
    },
]

SCENARIO_POSITION = {"ok": -0.45, "info": -0.12, "alerta": 0.45, "critico": 1.08}


def _crops(frames: List[pd.DataFrame], n: int, rng: np.random.Generator) -> np.ndarray:
    """Recortes de ``WINDOW`` pontos da grade de 10 s, ``(n, WINDOW, 3)`` em unidade bruta."""
    grids = [resample(f[list(CHANNELS)], RESAMPLE_RULE).to_numpy() for f in frames]
    out = np.empty((n, WINDOW, len(CHANNELS)))
    for i in range(n):
        g = grids[rng.integers(len(grids))]
        s = rng.integers(0, len(g) - WINDOW)
        out[i] = g[s:s + WINDOW]
    return out


def real_windows(frames: List[pd.DataFrame], n: int, rng: np.random.Generator) -> np.ndarray:
    raw = _crops(frames, n, rng)
    out = np.empty_like(raw)
    for i in range(n):
        lim = LIMIT_CLASSES[rng.integers(len(LIMIT_CLASSES))]
        for j, ch in enumerate(CHANNELS):
            out[i, :, j] = threshold_position(raw[i, :, j], lim[ch]["warn"], lim[ch]["crit"])
    return out


def _shapes(frames: List[pd.DataFrame], n: int, rng: np.random.Generator) -> np.ndarray:
    raw = _crops(frames, n, rng)
    mu = raw.mean(axis=1, keepdims=True)
    sd = raw.std(axis=1, keepdims=True)
    return np.clip((raw - mu) / (sd + 1e-6), -3, 3) / 3


def repositioned_windows(frames: List[pd.DataFrame], n: int, rng: np.random.Generator) -> np.ndarray:
    shape = _shapes(frames, n, rng)
    level = rng.uniform(-1.3, 1.7, size=(n, 1, 1))
    offset = rng.normal(0, 0.25, size=(n, 1, len(CHANNELS)))
    amp = rng.uniform(0.02, 0.35, size=(n, 1, len(CHANNELS)))
    noise = rng.normal(0, 1, size=shape.shape) * rng.uniform(0, 0.04, size=(n, 1, 1))
    return level + offset + amp * shape + noise


def scenario_windows(n: int, rng: np.random.Generator, jitter: float = 0.0) -> np.ndarray:
    """Mesma fórmula de ``public.synthetic_tick``: posição do perfil + respiração senoidal."""
    profiles = rng.choice(list(SCENARIO_POSITION), size=n)
    base = np.array([SCENARIO_POSITION[p] for p in profiles]) + rng.uniform(-jitter, jitter, n)
    epoch = rng.uniform(1.7e9, 1.9e9, size=n)
    seed = rng.uniform(0, 1000, size=n)
    k = np.arange(WINDOW) * 10.0
    phase = (epoch[:, None] + k[None, :]) / 160.0 + seed[:, None]
    t = base[:, None] + 0.070 * np.sin(phase) + 0.030 * np.sin(phase * 4.7 + 1.3)
    return np.repeat(t[:, :, None], len(CHANNELS), axis=2)


# ─── modos de degradação ────────────────────────────────────────────────────────

def thermal_ramp(w: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    w = w.copy()
    rise = rng.uniform(0.2, 1.4, size=(len(w), 1))
    start = rng.integers(0, WINDOW // 2, size=len(w))
    ramp = np.clip((np.arange(WINDOW)[None, :] - start[:, None]) / (WINDOW - start[:, None]), 0, 1)
    w[:, :, 2] += rise * ramp
    return w


def vibration_drift(w: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    w = w.copy()
    rise = rng.uniform(0.2, 1.2, size=(len(w), 1, 1))
    ramp = np.linspace(0, 1, WINDOW)[None, :, None]
    w[:, :, :2] += rise * ramp * rng.uniform(0.6, 1.0, size=(len(w), 1, 2))
    w[:, :, :2] += rng.normal(0, 0.08, size=w[:, :, :2].shape) * rise
    return w


def intermittent_spikes(w: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    w = w.copy()
    for i in range(len(w)):
        for _ in range(rng.integers(1, 4)):
            p = rng.integers(0, WINDOW - 2)
            ch = rng.integers(0, 2)
            w[i, p:p + rng.integers(1, 3), ch] += rng.uniform(0.3, 1.3)
    return w


def sample_dropout(w: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    w = w.copy()
    mask = rng.random(w.shape[:2]) < rng.uniform(0.02, 0.2)
    mask[:, -1] = False
    w[mask] = np.nan
    for i in range(len(w)):
        w[i] = pd.DataFrame(w[i]).ffill().bfill().to_numpy()
    return w


def missing_channel(w: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    w = w.copy()
    ch = rng.integers(0, len(CHANNELS), size=len(w))
    w[np.arange(len(w)), :, ch] = np.nan
    return w


def time_warp(w: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    out = np.empty_like(w)
    x = np.arange(WINDOW)
    for i in range(len(w)):
        stretch = rng.uniform(0.75, 1.3)
        xs = np.clip(x * stretch, 0, WINDOW - 1)
        for j in range(w.shape[2]):
            out[i, :, j] = np.interp(xs, x, w[i, :, j])
    return out


def build_dataset(frames: List[pd.DataFrame], n_per_family: int = 4000, seed: int = 42) -> dict:
    """Monta o conjunto aumentado. Devolve janelas e a família de origem de cada uma."""
    rng = np.random.default_rng(seed)
    base_real = real_windows(frames, n_per_family, rng)
    base_repo = repositioned_windows(frames, n_per_family, rng)

    families = {
        "real": base_real,
        "reposicionada": base_repo,
        "cenario": scenario_windows(n_per_family, rng),
        "cenario_fronteira": scenario_windows(n_per_family, rng, jitter=0.35),
        "rampa_termica": thermal_ramp(repositioned_windows(frames, n_per_family, rng), rng),
        "deriva_vibracao": vibration_drift(repositioned_windows(frames, n_per_family, rng), rng),
        "picos": intermittent_spikes(repositioned_windows(frames, n_per_family, rng), rng),
        "perda_amostras": sample_dropout(repositioned_windows(frames, n_per_family, rng), rng),
        "canal_ausente": missing_channel(repositioned_windows(frames, n_per_family, rng), rng),
        "distorcao_temporal": time_warp(base_repo[: n_per_family // 2], rng),
    }
    windows = np.concatenate(list(families.values()))
    family = np.concatenate([[name] * len(w) for name, w in families.items()])
    return {"windows": windows, "family": family}
