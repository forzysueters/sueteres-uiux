"""Valida o modelo único: treino com m1+m2 e detecção de degradação injetada."""
from src.model.baseline import fit_baseline, score_health


def test_baseline_trains_pooled(motors):
    b = fit_baseline(list(motors.values()), label="motor-iolink")
    assert b["n_segments"] == 2                 # m1 + m2 empilhados
    assert b["thermal"] is not None             # tem temperatura -> modelo térmico
    assert set(b["channels"]) == {"velocity", "acceleration", "temperature"}
    assert b["cal"]["ref"] > 0
    assert b["n_samples"] > 0


def test_healthy_scores_near_100(baseline, healthy_frame):
    res = score_health(healthy_frame, baseline)
    assert res["health_index"] >= 90
    assert res["severity"] in ("ok", "info")
    assert res["sustained"] is False


def test_injected_degradation_detected(baseline, healthy_frame, degraded_frame):
    healthy = score_health(healthy_frame, baseline)
    degraded = score_health(degraded_frame, baseline)

    # A degradação derruba a saúde e eleva a severidade.
    assert degraded["health_min"] < healthy["health_min"]
    assert degraded["severity"] in ("alerta", "critico")
    assert degraded["sustained"] is True


def test_second_motor_also_healthy(baseline, motors):
    # O modelo único também considera o Motor 2 saudável.
    res = score_health(motors["m2"], baseline)
    assert res["health_index"] >= 90
    assert res["severity"] in ("ok", "info")


def test_missing_temperature_channel(motors):
    # Segmentos sem temperatura: treina só com Isolation Forest, sem modelo térmico.
    segments = [m.drop(columns=["temperature"]) for m in motors.values()]
    b = fit_baseline(segments)
    assert b["thermal"] is None
    res = score_health(segments[0], b)
    assert 0 <= res["health_index"] <= 100
