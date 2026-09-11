"""Testes de engenharia de atributos genérica por ativo."""
from src.model.features import (
    build_features,
    has_thermal,
    load_channel,
    resample,
    thermal_features,
)


def test_resample_regular_grid(healthy_frame):
    r = resample(healthy_frame)
    # Grade fixa de 10s e sem buracos após interpolate/ffill/bfill.
    deltas = r.index.to_series().diff().dropna().dt.total_seconds().unique()
    assert list(deltas) == [10.0]
    assert not r.isna().any().any()


def test_load_and_thermal_channels(healthy_frame):
    r = resample(healthy_frame)
    assert load_channel(r) == "velocity"
    assert has_thermal(r) is True


def test_feature_columns(healthy_frame):
    r = resample(healthy_frame)
    f = build_features(r)
    # valor + std de cada canal, taxa térmica e duty do canal de carga.
    for c in ("velocity", "acceleration", "temperature"):
        assert c in f.columns
        assert f"{c}_std" in f.columns
    assert "temperature_rate" in f.columns
    assert "velocity_duty" in f.columns
    assert len(f) == len(r)
    assert not f.isna().any().any()


def test_features_deterministic(healthy_frame):
    r = resample(healthy_frame)
    f1 = build_features(r)
    f2 = build_features(r)
    assert f1.equals(f2)


def test_duty_cycle_range(healthy_frame):
    r = resample(healthy_frame)
    f = build_features(r)
    assert f["velocity_duty"].between(0, 1).all()


def test_thermal_features_shape(healthy_frame):
    r = resample(healthy_frame)
    tf = thermal_features(r)
    assert list(tf.columns) == ["load", "load_lag", "work_3min", "work_6min"]
    assert len(tf) == len(r)
