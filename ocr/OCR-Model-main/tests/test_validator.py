from src.postprocessing.validator import PhysicalValidator

v = PhysicalValidator()


def test_kw_cv_consistent():
    fields = {"potencia_kw": {"value": "2.2"}, "potencia_cv": {"value": "3.0"}}
    result = v.validate(fields, motor_type="monofasico")
    assert result["consistente"] is True
    assert len(result["alertas"]) == 0


def test_kw_cv_inconsistent():
    fields = {"potencia_kw": {"value": "10.0"}, "potencia_cv": {"value": "3.0"}}
    result = v.validate(fields, motor_type="monofasico")
    assert result["consistente"] is False
    assert any("kW" in a for a in result["alertas"])


def test_rpm_poles_hz_consistent():
    fields = {
        "rpm": {"value": "3500"}, "polos": {"value": "2"},
        "frequencia_hz": {"value": "60"}
    }
    result = v.validate(fields, motor_type="trifasico")
    assert result["consistente"] is True


def test_rpm_poles_hz_inconsistent():
    fields = {
        "rpm": {"value": "3500"}, "polos": {"value": "8"},
        "frequencia_hz": {"value": "60"}
    }
    result = v.validate(fields, motor_type="trifasico")
    assert any("RPM" in a for a in result["alertas"])


def test_missing_fields_no_crash():
    result = v.validate({}, motor_type="trifasico")
    assert "consistente" in result
    assert "alertas" in result
