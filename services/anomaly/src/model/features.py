"""Engenharia de atributos genérica por ativo.

Refatorado a partir das funções ``resample``/``features``/``_thermal_feat`` do notebook,
removendo o hardcode de dois motores (``m1``/``m2``) e as features de acoplamento
(``temp_div``/``vel_div``). Aqui tudo opera sobre **um único ativo** com um conjunto
arbitrário de canais de sensor nomeados.

Canais reconhecidos com semântica especial:
- ``velocity``     -> canal de carga (duty cycle, entrada do modelo térmico)
- ``temperature``  -> alvo do modelo térmico (taxa de variação)
- ``acceleration`` -> tratado como canal de carga alternativo se não houver velocity

Qualquer outro canal numérico ainda entra no detector como valor + desvio móvel.
"""
from __future__ import annotations

from typing import Optional

import pandas as pd

from ..config import DUTY_THRESHOLD, FEATURE_WIN, RESAMPLE_RULE

TEMP_CHANNEL = "temperature"
# Ordem de preferência para escolher o canal que representa "carga" do ativo.
LOAD_CHANNEL_PRIORITY = ["velocity", "acceleration"]


def resample(df: pd.DataFrame, rule: str = RESAMPLE_RULE) -> pd.DataFrame:
    """Reamostra para uma grade fixa (padrão 10s) e preenche pequenos vãos.

    ``df`` deve ser indexado por timestamp e conter apenas colunas numéricas de sensor.
    """
    return df.resample(rule).mean().interpolate(limit=6).ffill().bfill()


def load_channel(r: pd.DataFrame) -> Optional[str]:
    """Retorna o nome do canal de carga do ativo, se existir."""
    for c in LOAD_CHANNEL_PRIORITY:
        if c in r.columns:
            return c
    return None


def has_thermal(r: pd.DataFrame) -> bool:
    """Há dados suficientes para o modelo térmico (temperatura + carga)?"""
    return TEMP_CHANNEL in r.columns and load_channel(r) is not None


def build_features(r: pd.DataFrame, win: int = FEATURE_WIN) -> pd.DataFrame:
    """Atributos que capturam a dinâmica de operação, alimentados ao Isolation Forest.

    Para cada canal: o valor bruto e o desvio-padrão móvel. Se houver temperatura,
    a taxa de variação térmica. Se houver canal de carga, o *duty cycle*.
    """
    f = pd.DataFrame(index=r.index)
    for c in r.columns:
        f[c] = r[c]
        f[f"{c}_std"] = r[c].rolling(win, min_periods=1).std().fillna(0)

    if TEMP_CHANNEL in r.columns:
        f[f"{TEMP_CHANNEL}_rate"] = (
            r[TEMP_CHANNEL].diff().rolling(win, min_periods=1).mean().fillna(0)
        )

    load = load_channel(r)
    if load is not None:
        f[f"{load}_duty"] = (r[load] > DUTY_THRESHOLD).rolling(win, min_periods=1).mean()

    return f.fillna(0)


def thermal_features(r: pd.DataFrame) -> pd.DataFrame:
    """Features de carga usadas para prever a temperatura *esperada* (modelo térmico).

    Captura a inércia térmica: a temperatura responde à carga passada, não à instantânea.
    Requer ``has_thermal(r)`` verdadeiro.
    """
    load = load_channel(r)
    v = r[load]
    return pd.DataFrame(
        {
            "load": v,
            "load_lag": v.shift(6).fillna(0),        # 1 min atrás
            "work_3min": v.rolling(18, min_periods=1).mean(),
            "work_6min": v.rolling(36, min_periods=1).mean(),
        },
        index=r.index,
    )
