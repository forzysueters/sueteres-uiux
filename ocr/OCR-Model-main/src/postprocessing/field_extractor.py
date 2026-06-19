import re
from typing import Any

MONTHS_PT = "JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ"
MONTHS_EN = "JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC"
ALL_MONTHS = f"{MONTHS_PT}|{MONTHS_EN}"

# Corrige substituições comuns de OCR em campos numéricos (O→0, l/I→1)
_OCR_DIGIT_FIX = str.maketrans("OoIl", "0011")

_BEARING = r"([A-Z]{0,2}-?\d{3,4}[A-Z]{0,3}(?:-[A-Z0-9]+)*(?:-ZZ|-2Z)?)"

# Label-first: "RPM 1785" or "min-1 2915"
_RPM_LABEL_FIRST = r"(?:RPM|MIN-?1|MIN\^?-1|ROTACAO|ROT)[:\s]*(\d{3,4})\b"
# Value-first: "1785 RPM" or "2915 min-1"
_RPM_VALUE_FIRST = r"\b(\d{3,4})\s*(?:RPM\b|MIN-?1\b)"

PATTERNS: dict[str, str] = {
    "data_fabricacao": rf"(\d{{2}})({ALL_MONTHS})([0-9OoIl]{{2,4}})",
    "numero_serie":    r"(?<!\d)(\d{10})(?!\d)",
    "codigo_produto":  r"\b(BM\d{5})\b",
    "potencia_dual":   r"([1-9]\d*\.?\d*|0\.[1-9]\d*)\s*[\(\[]\s*(\d+\.?\d*)\s*[\)\]]",
    "tensao_v":        r"V\s*[:\s]\s*([\d]{3}(?:[-/][\d]{3})*)",
    "corrente_a":      r"A\s*[:\s]\s*(\d+\.?\d+(?:[/]\d+\.?\d+)*)",
    "frequencia_hz":   r"\b(50|60)\s*(?:Hz|HZ)?\b",
    "fator_servico":   r"\b(?:SF|FS)\s*[:\s]*(\d+\.?\d*)",
    "constante_partida": r"\b(?:Kc|KC|K\.?C\.?|In/IP|IP/In)\s*[:\s]*(\d+\.?\d*)",
    "fator_potencia":  r"\b(?:FP|P\.F\.|cos.?)\s*[:\s]*(\d+\.?\d*)",
    "categoria":       r"\bCAT\s*[:\s]*([NDH])\b",
    "classe_isolamento": r"\b(?:ISOL(?:\.?INSUL)?|INSL|INS\.?\s*CL\.?)\s*[:\s.]*([FHB])\b",
    "elevacao_temp_k": r"(?:Δt|ΔT|AT|\^T|ELEV|TEMP)\s*[:\s]*(\d+)\s*K",
    "grau_protecao":   r"\bIPW?(\d{2})\b",
    "carcaca":         r"\b(?:CARC|FRAME)\s*[:\s]*(\d{2,3}[SML]?(?:/[SML])?)\b",
    "regime_servico":  r"\b(S\d{1,2})\b",
    "temperatura_ambiente_c": r"(?:MAX\s*)?AMB[\.:,]?\s*(\d+)\s*°?[Cc]?",
    "altitude_m":      r"(?:ALT(?:ITUDE)?|AH)\.?\s*[:\s]*(\d+)\s*m",
    "rendimento_pct":  r"(?:REND(?:\.?EFF\.?)?|η)\s*%?\s*[:\s.]*(\d+\.?\d*)",
    "classe_eficiencia": r"\b(IE[1-4])\b",
    "tipo_motor_desc": r"(?:INDUCTION|INDU[CÇ][AÃ]O)\s*[-–]?\s*(SQUIRREL\s*CAGE|GAIOLA(?:\s*DE\s*ESQUILO)?)",
    "rolamento_front": rf"(?:Rol\.?D|FRONT|DRIVE)\s*[:\s]*{_BEARING}",
    "rolamento_rear":  rf"(?:Rol\.?T|REAR|OPP)\s*[:\s]*{_BEARING}",
    "norma":           r"((?:NBR|IEC)\s*\d{4,5}(?:-\d)?)",
    "peso_kg":         r"(\d+(?:\.\d+)?)\s*[Kk]g",
}

ZONE_EXPECTED_FIELDS: dict[int, list[str]] = {
    1: ["data_fabricacao", "numero_serie", "codigo_produto"],
    2: ["potencia_dual", "tensao_v", "corrente_a", "rpm", "frequencia_hz",
        "fator_servico", "constante_partida", "fator_potencia", "categoria",
        "classe_isolamento", "elevacao_temp_k", "grau_protecao", "carcaca",
        "rendimento_pct", "classe_eficiencia", "tipo_motor_desc"],
    3: ["regime_servico", "temperatura_ambiente_c", "altitude_m"],
    4: [],
    5: ["rolamento_front", "rolamento_rear", "norma", "peso_kg"],
}

_FIELD_RENAMES = {
    "rolamento_front": "rolamento_dianteiro",
    "rolamento_rear":  "rolamento_traseiro",
}

_SKIP = {"potencia_dual", "tensao_v", "corrente_a"}

# Tensões nominais industriais WEG reconhecidas (V)
_KNOWN_VOLTAGES = [110, 127, 220, 240, 380, 440, 480, 660, 760]

# Zonas espaciais da plaqueta WEG W22 (frações dentro da área de texto OCR)
# Coordenadas (x0, y0, x1, y1) auto-normalizadas pelo bounding box do texto detectado
FIELD_ZONES: dict[str, tuple[float, float, float, float]] = {
    "header":     (0.0,  0.00, 1.0,  0.22),  # WEG, série, código, tipo motor
    "potencia":   (0.0,  0.15, 0.70, 0.32),  # kW(HP-cv), carcaça
    "tensao":     (0.0,  0.28, 0.55, 0.48),  # V + 220/380
    "corrente":   (0.50, 0.28, 1.0,  0.48),  # A + 12.9/7.50
    "rpm_hz_sf":  (0.0,  0.44, 1.0,  0.60),  # RPM, Hz, SF, FP
    "rend_amb":   (0.0,  0.56, 0.80, 0.72),  # REND, AMB
    "isol_temp":  (0.75, 0.56, 1.0,  0.74),  # F, ΔT, K
    "regime":     (0.0,  0.68, 1.0,  0.84),  # N, IP55, S2, 1MIN, AH
    "rolamentos": (0.0,  0.83, 1.0,  1.00),  # rolamentos, NBR, peso
}

# Zonas prioritárias por campo (primeira que casar ganha)
_FIELD_ZONE_PRIORITY: dict[str, list[str]] = {
    "data_fabricacao":        ["header"],
    "numero_serie":           ["header"],
    "codigo_produto":         ["header"],
    "frequencia_hz":          ["rpm_hz_sf"],
    "fator_servico":          ["rpm_hz_sf"],
    "fator_potencia":         ["rpm_hz_sf"],
    "constante_partida":      ["rpm_hz_sf"],
    "rendimento_pct":         ["rend_amb"],
    "temperatura_ambiente_c": ["rend_amb", "regime"],
    "grau_protecao":          ["regime"],
    "regime_servico":         ["regime"],
    "altitude_m":             ["regime"],
    "categoria":              ["regime"],
    "classe_isolamento":      ["isol_temp", "regime"],
    "elevacao_temp_k":        ["isol_temp"],
    "classe_eficiencia":      ["rend_amb", "regime"],
    "tipo_motor_desc":        ["header", "potencia"],
    "carcaca":                ["potencia", "header"],
    "rolamento_front":        ["rolamentos"],
    "rolamento_rear":         ["rolamentos"],
    "norma":                  ["rolamentos"],
    "peso_kg":                ["rolamentos", "regime"],
}


def _confidence(match_in_expected_zone: bool) -> float:
    return 0.95 if match_in_expected_zone else 0.70


def _sanitize_segment(s: str) -> str:
    """Corrige confusões OCR em contexto numérico."""
    # O/o → 0: após dígito, antes de não-letra ou fim (ex: "38O4"→"3804", "38O"→"380")
    s = re.sub(r'(?<=[0-9])[Oo](?=[^A-Za-z]|$)', '0', s)
    # I/l → 1: mesma lógica
    s = re.sub(r'(?<=[0-9])[Il](?=[^A-Za-z]|$)', '1', s)
    # C → 0: OCR confunde "0" com "C" (ex: "22C "→"220 ", "22C/"→"220/")
    s = re.sub(r'(?<=[0-9])C(?=[0-9\s/\-]|$)', '0', s)
    # S → 5: apenas entre dígitos (S tem usos legítimos em outros contextos)
    s = re.sub(r'(?<=[0-9])S(?=[0-9])', '5', s)
    return s


def _match_known_voltage(val: int) -> int | None:
    """Retorna a tensão canônica mais próxima dentro de 8% de tolerância."""
    for known in _KNOWN_VOLTAGES:
        if abs(val - known) / known <= 0.08:
            return known
    return None


def _extract_tensao(text: str) -> list[str] | None:
    """
    Extrai tensões nominais de texto OCR ruidoso linha a linha.

    Fase 1 — Âncora robusta: localiza a linha do campo V tolerando "VI", "Vl", "V|".
    Fase 2 — Isolamento: corta antes do campo de corrente (decimais) ou Hz.
    Fase 3 — Janela deslizante: busca substrings de dígitos próximas a tensões
              conhecidas, mesmo quando o OCR gruda valores com chars adjacentes
              (ex: "38O4" → encontra "380" dentro de "3804").
    """
    for line in text.split('\n'):
        upper = line.upper()

        # Âncora robusta: "V" seguido de até 2 chars não-numéricos e ≥3 dígitos
        # (?=\d{3}) exige 3+ dígitos à frente (todas tensões nominais são ≥100V)
        # Impede match em "V2", "V1" (labels de diagrama de ligação)
        # Exemplos aceitos: "VI220", "V 220", "V|220", "V220", "Vl380"
        m = re.search(r'\bV[^0-9]{0,2}(?=\d{3})', upper)
        if not m:
            continue

        segment = upper[m.end():]

        # Corta antes do campo de corrente (decimal) ou frequência
        stop = re.search(r'\d\.\d|\bHz\b', segment)
        if stop:
            segment = segment[:stop.start()]

        segment = re.sub(r'[\s/\-\[\]]+$', '', segment)
        if not segment:
            continue

        segment = _sanitize_segment(segment)

        # Janela deslizante sobre cada bloco numérico contínuo
        found: list[str] = []
        for num_block in re.findall(r'\d+', segment):
            matched = False
            for length in (4, 3, 2):        # maior comprimento primeiro
                if matched:
                    break
                for start in range(len(num_block) - length + 1):
                    chunk = num_block[start:start + length]
                    canonical = _match_known_voltage(int(chunk))
                    if canonical and str(canonical) not in found:
                        found.append(str(canonical))
                        matched = True
                        break

        if found:
            return sorted(found, key=int)

    # Segunda passagem: linha só com dígitos e separadores (V na caixa separada)
    # Ex: "220/380" isolado — OCR separou o label V do valor
    # Usa matching EXATO (sem sliding window) para evitar falsos positivos de códigos
    # de rolamento como "6262-ZZ" que contêm substrings próximas de tensões conhecidas.
    for line in text.split('\n'):
        stripped = line.strip()
        if not re.match(r'^[\d/\-\s]+$', stripped):
            continue
        if not re.search(r'\d{2,3}[/\-]\d{2,3}', stripped):
            continue
        segment = _sanitize_segment(stripped)
        found = []
        for num_block in re.findall(r'\d+', segment):
            try:
                val = int(num_block)
            except ValueError:
                continue
            if val in _KNOWN_VOLTAGES and str(val) not in found:
                found.append(str(val))
        if found:
            return sorted(found, key=int)

    return None


def _extract_corrente(text: str) -> list[str] | None:
    """
    Extrai correntes nominais de texto OCR ruidoso.

    Na plaqueta WEG "A" e "V" ficam na mesma linha: "V 220/380  A  12.9/7.50"
    EasyOCR frequentemente confunde o label "A" isolado com "4".
    Estratégia: localiza a linha de tensão e busca os decimais após âncora A/4.
    """
    for line in text.split('\n'):
        upper = line.upper()

        if not re.search(r'\bV[^0-9]{0,2}(?=\d{3})', upper):
            continue

        # Âncora: "A" ou "4" isolados (confusão OCR A→4), seguido de decimais
        m = re.search(r'\b[A4]\b\s*(\d+\.\d+(?:/\d+\.\d+)*)', upper)
        if m:
            parts = m.group(1).split('/')
            return [p.strip() for p in parts]

        # Fallback: todos os decimais na linha (correntes são decimais; tensões são inteiras)
        decimals = re.findall(r'\b\d+\.\d+\b', upper)
        if decimals:
            return decimals

    # Segunda passagem: "A" explícito em linha sem tensão co-localizada
    for line in text.split('\n'):
        upper = line.upper()
        m = re.search(r'\bA\s*[:\s]+(\d+\.\d+(?:/\d+\.\d+)*)', upper)
        if m:
            parts = m.group(1).split('/')
            return [p.strip() for p in parts]

    return None


def _extract_corrente_direct(text: str) -> list[str] | None:
    """Extrai correntes do texto de uma zona espacial dedicada (sem âncora V)."""
    upper = text.upper()
    # Remove valores de eficiência/rendimento que aparecem na zona (ex: "NR[95.6", "REND 76.0")
    clean = re.sub(r'(?:REND|NR|EFF?)\s*[:\[\s]*[\d.]+', '', upper)
    clean = re.sub(r'[\d.]+\s*%', '', clean)
    m = re.search(r'(\d+\.\d+(?:/\d+\.\d+)+)', clean)
    if m:
        return [p.strip() for p in m.group(1).split('/')]
    decimals = re.findall(r'\b(\d+\.\d+)\b', clean)
    return decimals if decimals else None


def _extract_rpm(upper: str) -> str | None:
    m = re.search(_RPM_LABEL_FIRST, upper, re.IGNORECASE)
    if not m:
        m = re.search(_RPM_VALUE_FIRST, upper, re.IGNORECASE)
    return m.group(1).strip() if m else None


class FieldExtractor:
    def extract_from_zone(self, zone_id: int,
                          text: str) -> dict[str, dict[str, Any]]:
        if zone_id == 4:
            return {}

        expected = ZONE_EXPECTED_FIELDS.get(zone_id, [])
        result: dict[str, dict[str, Any]] = {}
        upper = text.upper()

        for field, pattern in PATTERNS.items():
            if field in _SKIP:
                continue
            m = re.search(pattern, upper, re.IGNORECASE)
            if m:
                if field == "data_fabricacao":
                    year = m.group(3).translate(_OCR_DIGIT_FIX)
                    value = m.group(1) + m.group(2) + year
                else:
                    value = m.group(1).strip()
                in_zone = field in expected
                fname = _FIELD_RENAMES.get(field, field)
                result[fname] = {"value": value, "confidence": _confidence(in_zone)}

        rpm_val = _extract_rpm(upper)
        if rpm_val:
            in_zone = "rpm" in expected
            result["rpm"] = {"value": rpm_val, "confidence": _confidence(in_zone)}

        m = re.search(PATTERNS["potencia_dual"], upper)
        if m:
            in_zone = "potencia_dual" in expected
            result["potencia_kw"] = {"value": m.group(1), "confidence": _confidence(in_zone)}
            result["potencia_cv"] = {"value": m.group(2), "confidence": _confidence(in_zone)}

        # Regex clássico primeiro (texto OCR limpo, preserva ranges "110-127")
        tensao = None
        m = re.search(PATTERNS["tensao_v"], upper)
        if m:
            raw = m.group(1)
            parts = re.split(r"/(?!\d*-)", raw)
            if len(parts) == 1:
                parts = raw.split("/")
            tensao = [p.strip() for p in parts]
        # Fallback: extração por domínio para OCR ruidoso ("VI220 38O4/...")
        if not tensao:
            tensao = _extract_tensao(text)
        if tensao:
            in_zone = "tensao_v" in expected
            result["tensao_v"] = {"value": tensao, "confidence": _confidence(in_zone)}

        # \bA[:\s] evita falso-positivo de "FRa 76.0" → "FRA 76.0"
        corrente = None
        m = re.search(r'\bA[:\s]\s*(\d+\.\d+(?:[/]\d+\.\d+)*)', upper)
        if m:
            corrente = [p.strip() for p in m.group(1).split('/')]
        if not corrente:
            corrente = _extract_corrente(text)
        if corrente:
            in_zone = "corrente_a" in expected
            result["corrente_a"] = {"value": corrente, "confidence": _confidence(in_zone)}

        selos = [s for s in ["INMETRO", "PROCEL", "CE"] if re.search(rf"\b{s}\b", upper)]
        if selos:
            result["selos"] = {"value": selos, "confidence": 0.92}

        return result

    def extract_from_full_image(self, text: str) -> dict[str, dict[str, Any]]:
        result: dict[str, dict[str, Any]] = {}
        upper = text.upper()
        conf = 0.80

        for field, pattern in PATTERNS.items():
            if field in _SKIP:
                continue
            m = re.search(pattern, upper, re.IGNORECASE)
            if m:
                if field == "data_fabricacao":
                    year = m.group(3).translate(_OCR_DIGIT_FIX)
                    value = m.group(1) + m.group(2) + year
                else:
                    value = m.group(1).strip()
                fname = _FIELD_RENAMES.get(field, field)
                result[fname] = {"value": value, "confidence": conf}

        rpm_val = _extract_rpm(upper)
        if rpm_val:
            result["rpm"] = {"value": rpm_val, "confidence": conf}

        m = re.search(PATTERNS["potencia_dual"], upper)
        if m:
            result["potencia_kw"] = {"value": m.group(1), "confidence": conf}
            result["potencia_cv"] = {"value": m.group(2), "confidence": conf}

        tensao = None
        m = re.search(PATTERNS["tensao_v"], upper)
        if m:
            raw = m.group(1)
            parts = re.split(r"/(?!\d*-)", raw)
            if len(parts) == 1:
                parts = raw.split("/")
            tensao = [p.strip() for p in parts]
        if not tensao:
            tensao = _extract_tensao(text)
        if tensao:
            result["tensao_v"] = {"value": tensao, "confidence": conf}

        corrente = None
        m = re.search(r'\bA[:\s]\s*(\d+\.\d+(?:[/]\d+\.\d+)*)', upper)
        if m:
            corrente = [p.strip() for p in m.group(1).split('/')]
        if not corrente:
            corrente = _extract_corrente(text)
        if corrente:
            result["corrente_a"] = {"value": corrente, "confidence": conf}

        selos = [s for s in ["INMETRO", "PROCEL", "CE"] if re.search(rf"\b{s}\b", upper)]
        if selos:
            result["selos"] = {"value": selos, "confidence": 0.92}

        return result

    def extract_from_bboxes(self, bboxes: list[dict]) -> dict[str, dict[str, Any]]:
        """
        Extrai campos usando posição espacial dos bounding boxes do EasyOCR.

        Coordenadas dos bboxes devem estar normalizadas em [0,1] relativas à imagem.
        O método auto-normaliza dentro do bounding box do texto detectado, tornando a
        extração independente de recorte ou perspectiva da foto.
        """
        if not bboxes:
            return {}

        # Auto-normaliza dentro da área coberta pelo texto detectado
        all_x = [b["x0"] for b in bboxes] + [b["x1"] for b in bboxes]
        all_y = [b["y0"] for b in bboxes] + [b["y1"] for b in bboxes]
        tx0, ty0 = min(all_x), min(all_y)
        tw = (max(all_x) - tx0) or 1.0
        th = (max(all_y) - ty0) or 1.0

        def _cx(b: dict) -> float:
            return ((b["x0"] + b["x1"]) / 2 - tx0) / tw

        def _cy(b: dict) -> float:
            return ((b["y0"] + b["y1"]) / 2 - ty0) / th

        # Agrupa texto por zona
        zone_words: dict[str, list[str]] = {z: [] for z in FIELD_ZONES}
        for b in bboxes:
            x, y = _cx(b), _cy(b)
            for zone, (zx0, zy0, zx1, zy1) in FIELD_ZONES.items():
                if zx0 <= x <= zx1 and zy0 <= y <= zy1:
                    zone_words[zone].append(b["text"])
                    break

        zone_texts = {z: " ".join(words) for z, words in zone_words.items()}
        full_text = "\n".join(v for v in zone_texts.values() if v)
        result: dict[str, dict[str, Any]] = {}
        conf = 0.85  # bbox-based tem confiança maior que full-image (0.80)

        # Tensão: zona dedicada + fallback full
        tensao = _extract_tensao(zone_texts["tensao"]) or _extract_tensao(full_text)
        if tensao:
            result["tensao_v"] = {"value": tensao, "confidence": conf}

        # Corrente: zona dedicada (sem âncora V) + fallback full
        corrente = (
            _extract_corrente_direct(zone_texts["corrente"])
            or _extract_corrente(full_text)
        )
        if corrente:
            result["corrente_a"] = {"value": corrente, "confidence": conf}

        # RPM: zona dedicada + fallback full
        rpm = _extract_rpm(zone_texts["rpm_hz_sf"].upper()) or _extract_rpm(full_text.upper())
        if rpm:
            result["rpm"] = {"value": rpm, "confidence": conf}

        # Potência dual: zona dedicada
        for zone in ("potencia", "header"):
            m = re.search(PATTERNS["potencia_dual"], zone_texts[zone].upper())
            if m:
                result["potencia_kw"] = {"value": m.group(1), "confidence": conf}
                result["potencia_cv"] = {"value": m.group(2), "confidence": conf}
                break

        # Campos via regex nas zonas prioritárias
        for field, pattern in PATTERNS.items():
            if field in _SKIP:
                continue
            zones = _FIELD_ZONE_PRIORITY.get(field, list(FIELD_ZONES.keys()))
            for zone in zones:
                search_text = zone_texts.get(zone, "").upper()
                m = re.search(pattern, search_text, re.IGNORECASE)
                if m:
                    if field == "data_fabricacao":
                        year = m.group(3).translate(_OCR_DIGIT_FIX)
                        value = m.group(1) + m.group(2) + year
                    else:
                        value = m.group(1).strip()
                    fname = _FIELD_RENAMES.get(field, field)
                    result[fname] = {"value": value, "confidence": conf}
                    break

        selos = [s for s in ["INMETRO", "PROCEL", "CE"] if re.search(rf"\b{s}\b", full_text.upper())]
        if selos:
            result["selos"] = {"value": selos, "confidence": 0.92}

        return result

    def merge_zones(self, zone_results: dict[int, dict]) -> dict[str, dict]:
        merged: dict[str, dict] = {}
        for _zone_id, fields in zone_results.items():
            for fname, fval in fields.items():
                if fname not in merged:
                    merged[fname] = fval
                elif fval["confidence"] > merged[fname]["confidence"]:
                    merged[fname] = fval
        return merged
