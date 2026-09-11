import math
import re
from typing import Literal

FRAME_POWER_RANGE = {
    "63": (0.16, 0.5), "71": (0.25, 0.75), "80": (0.5, 1.5),
    "90L": (1.0, 3.0), "90S": (0.75, 2.0), "100L": (2.0, 5.0),
    "112M": (3.0, 7.5), "132S": (5.5, 10.0), "132M": (7.5, 15.0),
    "160M": (11.0, 25.0), "160L": (15.0, 30.0),
}


def _get(fields: dict, key: str) -> float | None:
    try:
        return float(fields[key]["value"])
    except (KeyError, ValueError, TypeError):
        return None


def _get_list(fields: dict, key: str) -> list[float] | None:
    try:
        vals = fields[key]["value"]
        if isinstance(vals, list):
            return [float(v.split("-")[0]) for v in vals]
        return [float(vals)]
    except (KeyError, ValueError, TypeError):
        return None


class PhysicalValidator:
    def validate(self, fields: dict,
                 motor_type: Literal["monofasico", "trifasico"] = "trifasico") -> dict:
        alertas = []

        # 1. kW vs cv (1 cv = 0.7355 kW, tolerância 8%)
        kw = _get(fields, "potencia_kw")
        cv = _get(fields, "potencia_cv")
        if kw is not None and cv is not None:
            expected_kw = cv * 0.7355
            if abs(kw - expected_kw) / expected_kw > 0.08:
                alertas.append(
                    f"Inconsistência kW/cv: {kw} kW ≠ {cv} cv × 0.7355 = {expected_kw:.2f} kW"
                )

        # 2. RPM vs polos vs frequência
        rpm = _get(fields, "rpm")
        poles_raw = _get(fields, "polos")
        hz = _get(fields, "frequencia_hz")
        if rpm and poles_raw and hz:
            poles = int(poles_raw)
            if poles in (2, 4, 6, 8):
                sync = 120 * hz / poles
                slip = rpm / sync
                if not (0.93 < slip < 0.99):
                    alertas.append(
                        f"RPM {rpm} incompatível com {poles} polos / {hz}Hz (síncr={sync:.0f})"
                    )

        # 3. Carcaça vs potência cv
        frame = fields.get("carcaca", {}).get("value")
        if frame and cv:
            frame_key = re.sub(r"[^A-Z0-9]", "", frame.upper())
            if frame_key in FRAME_POWER_RANGE:
                lo, hi = FRAME_POWER_RANGE[frame_key]
                if not (lo * 0.8 <= cv <= hi * 1.2):
                    alertas.append(
                        f"Carcaça {frame} incomum para {cv} cv (esperado {lo}-{hi} cv)"
                    )

        # 4. Número de tensões vs correntes
        tens = _get_list(fields, "tensao_v")
        corr = _get_list(fields, "corrente_a")
        if tens and corr and len(tens) != len(corr):
            alertas.append(
                f"Qtd de tensões ({len(tens)}) ≠ qtd de correntes ({len(corr)})"
            )

        # 5. Verificação elétrica completa
        if kw and tens and corr:
            u = tens[0]
            i = corr[0]
            pf = _get(fields, "fator_potencia")
            rend = _get(fields, "rendimento_pct")
            if pf and rend:
                eta = rend / 100
                if motor_type == "trifasico":
                    p_calc = math.sqrt(3) * u * i * pf * eta / 1000
                else:
                    p_calc = u * i * pf * eta / 1000
                if abs(p_calc - kw) / kw > 0.15:
                    alertas.append(
                        f"Potência elétrica calculada {p_calc:.2f} kW difere da nominal {kw} kW (>15%)"
                    )

        return {"consistente": len(alertas) == 0, "alertas": alertas}

    def normalize(self, fields: dict) -> dict:
        MONTH_MAP = {
            "JAN": "01", "FEV": "02", "MAR": "03", "ABR": "04",
            "MAI": "05", "JUN": "06", "JUL": "07", "AGO": "08",
            "SET": "09", "OUT": "10", "NOV": "11", "DEZ": "12",
        }
        MONTHS_PT = "|".join(MONTH_MAP.keys())
        normalized = dict(fields)
        if "data_fabricacao" in normalized:
            raw = normalized["data_fabricacao"]["value"]
            m = re.match(rf"(\d{{2}})({MONTHS_PT})(\d{{2,4}})", raw.upper())
            if m:
                day, mon, yr = m.group(1), m.group(2), m.group(3)
                yr_full = (2000 + int(yr)) if len(yr) == 2 else int(yr)
                iso = f"{yr_full}-{MONTH_MAP[mon]}-{day}"
                normalized["data_fabricacao"] = {
                    **normalized["data_fabricacao"],
                    "value_iso": iso,
                }
        return normalized
