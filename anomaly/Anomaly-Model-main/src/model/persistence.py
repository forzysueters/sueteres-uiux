"""Persistência do modelo único pré-treinado.

O serviço usa **um** baseline treinado a partir do histórico saudável em ``data/`` e o aplica
a qualquer ativo. O artefato é gerado por ``train_baseline.py`` e versionado no repo.
"""
from __future__ import annotations

from pathlib import Path

import joblib

from ..config import MODELS_DIR

DEFAULT_BASELINE_PATH: Path = MODELS_DIR / "baseline.joblib"


def save_baseline(baseline: dict, path: Path = DEFAULT_BASELINE_PATH) -> Path:
    joblib.dump(baseline, path)
    return path


def load_baseline(path: Path = DEFAULT_BASELINE_PATH) -> dict:
    if not path.exists():
        raise FileNotFoundError(
            f"Modelo não encontrado em {path}. Rode `python train_baseline.py` para gerá-lo."
        )
    return joblib.load(path)


def baseline_exists(path: Path = DEFAULT_BASELINE_PATH) -> bool:
    return path.exists()
