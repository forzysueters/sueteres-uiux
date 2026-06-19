from src.postprocessing.field_extractor import FieldExtractor

ext = FieldExtractor()


def test_data_fabricacao_ddmmmyyyy():
    r = ext.extract_from_zone(1, "WEG W22 01SET2016 SN:1033422690")
    assert r["data_fabricacao"]["value"] == "01SET2016"


def test_data_fabricacao_ddmmmyy():
    r = ext.extract_from_zone(1, "25MAR04 BM20035")
    assert r["data_fabricacao"]["value"] == "25MAR04"


def test_numero_serie_10_digitos():
    r = ext.extract_from_zone(1, "S/N: 1037018844 outros dados")
    assert r["numero_serie"]["value"] == "1037018844"


def test_potencia_dual():
    r = ext.extract_from_zone(2, "kW(HP-cv): 2.2(3.0)")
    assert r["potencia_kw"]["value"] == "2.2"
    assert r["potencia_cv"]["value"] == "3.0"


def test_tensao_multipla_slash():
    r = ext.extract_from_zone(2, "V: 220/380/440")
    assert r["tensao_v"]["value"] == ["220", "380", "440"]


def test_tensao_multipla_dash():
    r = ext.extract_from_zone(2, "V: 110-127/220-254")
    assert r["tensao_v"]["value"] == ["110-127", "220-254"]


def test_ip_grau_protecao():
    r = ext.extract_from_zone(2, "IP55 REG S1")
    assert r["grau_protecao"]["value"] == "55"


def test_regime_servico():
    r = ext.extract_from_zone(3, "REG DUTY: S1")
    assert r["regime_servico"]["value"] == "S1"


def test_rolamento_format():
    r = ext.extract_from_zone(5, "Rol.D: 6205-ZZ  Rol.T: 6204-ZZ")
    assert r["rolamento_dianteiro"]["value"] == "6205-ZZ"
    assert r["rolamento_traseiro"]["value"] == "6204-ZZ"


def test_norma_nfr():
    r = ext.extract_from_zone(5, "NBR 17094 INMETRO PROCEL")
    assert r["norma"]["value"] == "NBR 17094"


def test_selos():
    r = ext.extract_from_zone(5, "INMETRO PROCEL CE NBR7094")
    assert "INMETRO" in r["selos"]["value"]
    assert "PROCEL" in r["selos"]["value"]
    assert "CE" in r["selos"]["value"]


def test_unknown_zone_returns_empty():
    r = ext.extract_from_zone(4, "qualquer texto de diagrama")
    assert r == {}
