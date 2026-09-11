"""Testes de integração da API FastAPI (modelo único pré-treinado)."""
import pytest
from fastapi.testclient import TestClient

from src.api import main
from src.model.persistence import DEFAULT_BASELINE_PATH, save_baseline
from tests.conftest import readings_from_frame

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def ensure_model(baseline):
    """Garante o modelo único em disco e reseta o cache do app entre testes."""
    if not DEFAULT_BASELINE_PATH.exists():
        save_baseline(baseline)
    main._baseline = None
    yield
    main._baseline = None


def test_health_reports_model_loaded():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["service"] == "anomaly-model"
    assert body["model_loaded"] is True


def test_score_healthy(healthy_frame):
    resp = client.post(
        "/anomaly/score",
        json={"asset_tag": "MTR-001", "readings": readings_from_frame(healthy_frame)},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["asset_tag"] == "MTR-001"
    assert body["health_index"] >= 90
    assert body["severity"] in ("ok", "info")
    assert isinstance(body["insight"], str) and body["insight"]


def test_score_without_asset_tag(healthy_frame):
    # asset_tag é opcional (o modelo é compartilhado).
    resp = client.post(
        "/anomaly/score",
        json={"readings": readings_from_frame(healthy_frame)[:200]},
    )
    assert resp.status_code == 200
    assert resp.json()["asset_tag"] is None


def test_score_degraded(degraded_frame):
    resp = client.post(
        "/anomaly/score",
        json={"asset_tag": "MTR-001", "readings": readings_from_frame(degraded_frame)},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["severity"] in ("alerta", "critico")
    assert body["sustained"] is True
    assert body["health_min"] < 65


def test_score_returns_503_when_model_missing(monkeypatch, healthy_frame):
    def _raise():
        raise FileNotFoundError("Modelo não encontrado")

    monkeypatch.setattr(main, "load_baseline", _raise)
    main._baseline = None
    resp = client.post(
        "/anomaly/score",
        json={"readings": readings_from_frame(healthy_frame)[:50]},
    )
    assert resp.status_code == 503
