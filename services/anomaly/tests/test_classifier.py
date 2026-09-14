"""O classificador supervisionado reproduz a planta simulada e o rótulo normativo."""
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from src.api import main
from src.model.augment import LIMIT_CLASSES, SCENARIO_POSITION, WINDOW, build_dataset
from src.model.classifier import (
    classifier_exists,
    classify_window,
    frame_to_window,
    insight_for,
    load_classifier,
)
from src.model.normative import CHANNELS, SEVERITIES, teacher, threshold_value

pytestmark = pytest.mark.skipif(not classifier_exists(), reason="rode train_classifier.py")


@pytest.fixture(scope="module")
def model():
    return load_classifier()


def scenario_frame(profile: str, limits: dict, epoch: float, seed: float) -> pd.DataFrame:
    """Janela gerada pela mesma fórmula de ``public.synthetic_tick`` (0018)."""
    ts = epoch + np.arange(WINDOW) * 10.0
    phase = ts / 160.0 + seed
    t = SCENARIO_POSITION[profile] + 0.070 * np.sin(phase) + 0.030 * np.sin(phase * 4.7 + 1.3)
    data = {ch: threshold_value(t, limits[ch]["warn"], limits[ch]["crit"]) for ch in CHANNELS}
    return pd.DataFrame(data, index=pd.to_datetime(ts, unit="s", utc=True))


@pytest.mark.parametrize("profile", list(SCENARIO_POSITION))
@pytest.mark.parametrize("limits", LIMIT_CLASSES)
def test_scenario_profiles_are_reproduced(model, profile, limits):
    rng = np.random.default_rng(7)
    for _ in range(25):
        df = scenario_frame(profile, limits, rng.uniform(1.7e9, 1.9e9), rng.uniform(0, 1000))
        window = frame_to_window(df, limits)
        result = classify_window(window, model)
        expected = teacher(window[None])
        assert result["severity"] == profile
        assert abs(result["health_index"] - expected["health"][0]) < 3


def test_live_plant_severities(model):
    """Perfis e limites exatamente como estão na tabela `sensors` hoje."""
    plant = {
        "CMP-001": ("critico", {"velocity": (4.5, 7.1), "acceleration": (1.39, 2.19), "temperature": (75, 90)}),
        "MTR-002": ("critico", {"velocity": (4.5, 7.1), "acceleration": (0.69, 1.09), "temperature": (75, 90)}),
        "BBA-001": ("alerta", {"velocity": (2.8, 4.5), "acceleration": (0.43, 0.68), "temperature": (70, 85)}),
        "LAB-S2": ("alerta", {"velocity": (4.5, 7.1), "acceleration": (10, 20), "temperature": (75, 90)}),
        "LAB-S1": ("info", {"velocity": (4.5, 7.1), "acceleration": (10, 20), "temperature": (75, 90)}),
        "MTR-001": ("ok", {"velocity": (4.5, 7.1), "acceleration": (0.83, 1.31), "temperature": (75, 90)}),
        "EXA-001": ("ok", {"velocity": (2.8, 4.5), "acceleration": (0.50, 0.81), "temperature": (70, 85)}),
    }
    for tag, (profile, lim) in plant.items():
        limits = {ch: {"warn": w, "crit": c} for ch, (w, c) in lim.items()}
        df = scenario_frame(profile, limits, 1.8e9, hash(tag) % 1000)
        assert classify_window(frame_to_window(df, limits), model)["severity"] == profile, tag


def test_missing_channel_still_classifies(model):
    limits = LIMIT_CLASSES[0]
    df = scenario_frame("alerta", limits, 1.8e9, 3.0).drop(columns=["temperature"])
    result = classify_window(frame_to_window(df, limits), model)
    assert result["severity"] in SEVERITIES
    assert "resíduo térmico" not in insight_for(result)


def test_augmentation_families_and_shape(motors):
    data = build_dataset(list(motors.values()), n_per_family=20, seed=1)
    assert data["windows"].shape[1:] == (WINDOW, len(CHANNELS))
    assert len(set(data["family"])) == 10
    labels = teacher(data["windows"])["severity"]
    assert set(np.unique(labels)) <= {0, 1, 2, 3}


def test_api_uses_classifier_when_limits_are_sent():
    main._classifier = None
    limits = LIMIT_CLASSES[0]
    df = scenario_frame("critico", limits, 1.8e9, 11.0)
    body = {
        "asset_tag": "CMP-001",
        "readings": [{"timestamp": ts.isoformat(), "sensors": row.to_dict()} for ts, row in df.iterrows()],
        "limits": limits,
    }
    resp = TestClient(main.app).post("/anomaly/score", json=body)
    assert resp.status_code == 200
    out = resp.json()
    assert out["model_used"] == "classifier"
    assert out["severity"] == "critico"
    assert out["health_index"] < 45
    assert abs(sum(out["probabilities"].values()) - 1) < 1e-3
    assert out["rul_days"] >= 1
