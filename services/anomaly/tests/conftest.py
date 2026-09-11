"""Fixtures compartilhadas: carrega o dado de exemplo e gera uma degradação injetada."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Garante que o pacote `src` é importável ao rodar `pytest` da raiz do repo.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import DATA_DIR  # noqa: E402
from src.data_loader import load_iolink_csv  # noqa: E402


@pytest.fixture(scope="session")
def sample_csv() -> Path:
    matches = list(DATA_DIR.glob("History_*.csv"))
    assert matches, f"CSV de exemplo não encontrado em {DATA_DIR}"
    return matches[0]


@pytest.fixture(scope="session")
def motors(sample_csv) -> dict:
    """Frames canônicos dos dois motores do CSV."""
    return load_iolink_csv(str(sample_csv))


@pytest.fixture(scope="session")
def healthy_frame(motors) -> pd.DataFrame:
    """Frame canônico do Motor 1, assumido saudável."""
    return motors["m1"]


@pytest.fixture(scope="session")
def baseline(motors):
    """Modelo único treinado com os dois motores empilhados (mesmo do train_baseline.py)."""
    from src.model.baseline import fit_baseline
    return fit_baseline(list(motors.values()), label="motor-iolink")


@pytest.fixture()
def degraded_frame(healthy_frame) -> pd.DataFrame:
    """Motor 1 com degradação injetada decisiva (superaquecimento + instabilidade).

    Rampa térmica de +20°C na fase final: sem as features de acoplamento entre motores
    (que o notebook usava), o detector por ativo isolado exige um desvio claramente
    anômalo — o que uma falha real de rolamento gerando calor produziria.
    """
    df = healthy_frame.copy()
    n = len(df)
    s0 = int(n * 0.72)
    ramp = np.zeros(n)
    ramp[s0:] = np.linspace(0, 20, n - s0)
    df["temperature"] = df["temperature"] + ramp

    rng = np.random.default_rng(1)
    k = int(n * 0.88)
    noise = np.zeros(n)
    noise[k:] = rng.normal(0, 0.7, n - k)
    df["velocity"] = (df["velocity"] + noise).clip(lower=0)
    return df


def readings_from_frame(df: pd.DataFrame) -> list[dict]:
    """Converte um frame canônico para o formato de leituras da API."""
    return [
        {"timestamp": ts.isoformat(), "sensors": row.dropna().to_dict()}
        for ts, row in df.iterrows()
    ]
