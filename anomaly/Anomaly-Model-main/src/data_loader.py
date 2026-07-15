"""Utilitários para converter dados de sensores em frames canônicos por ativo.

Dois formatos de entrada:
1. Log IO-Link em CSV (o dado histórico de exemplo em ``data/``), com dois motores.
2. Lista de leituras estruturadas vinda da API (``[{timestamp, sensors:{...}}]``).

A saída canônica é sempre um ``DataFrame`` indexado por timestamp cujas colunas são
canais de sensor nomeados (``velocity``, ``acceleration``, ``temperature``, ...).
"""
from __future__ import annotations

from typing import Iterable, Mapping

import pandas as pd

# Colunas do log IO-Link de exemplo (3 linhas de cabeçalho, separador ';').
_IOLINK_COLUMNS = [
    "timestamp", "p1_bytes", "p2_bytes",
    "m1_vel", "m1_acc", "m1_temp",
    "m2_vel", "m2_acc", "m2_temp",
]
# Mapeia sufixo do CSV -> nome canônico de canal.
_CANON = {"vel": "velocity", "acc": "acceleration", "temp": "temperature"}


def readings_to_frame(readings: Iterable[Mapping]) -> pd.DataFrame:
    """Converte leituras estruturadas da API num frame canônico por timestamp.

    Cada leitura: ``{"timestamp": <iso/datetime>, "sensors": {"velocity": ..., ...}}``.
    """
    rows, index = [], []
    for rd in readings:
        index.append(pd.to_datetime(rd["timestamp"]))
        rows.append({k: float(v) for k, v in rd["sensors"].items()})
    if not rows:
        raise ValueError("Nenhuma leitura fornecida.")
    df = pd.DataFrame(rows, index=pd.DatetimeIndex(index))
    return df.sort_index()


def load_iolink_csv(path: str) -> dict[str, pd.DataFrame]:
    """Lê o CSV IO-Link de exemplo e devolve um frame canônico por motor.

    Retorna ``{"m1": <frame>, "m2": <frame>}`` com colunas
    ``velocity``/``acceleration``/``temperature``.
    """
    df = pd.read_csv(path, sep=";", header=None, skiprows=3, names=_IOLINK_COLUMNS)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").set_index("timestamp")

    out: dict[str, pd.DataFrame] = {}
    for motor in ("m1", "m2"):
        cols = {f"{motor}_{suf}": canon for suf, canon in _CANON.items()}
        sub = df[list(cols)].apply(pd.to_numeric, errors="coerce")
        out[motor] = sub.rename(columns=cols)
    return out
