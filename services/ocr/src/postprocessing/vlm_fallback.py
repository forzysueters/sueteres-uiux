"""
Fallback VLM (visão) para campos críticos ausentes após o pipeline OCR principal.

Usa a API da OpenAI (Chat Completions com a imagem embutida em data URL). A
chave vem de `OPENAI_API_KEY`; o modelo, de `OPENAI_VISION_MODEL` (padrão
`gpt-5.4-mini`) — dá para trocar de modelo sem mexer no código.

Só depende de `requests`: nenhum SDK extra a instalar.
"""
import base64
import json
import logging
import os
import re
from io import BytesIO
from typing import Any

import requests
from PIL import Image

logger = logging.getLogger(__name__)

CRITICAL_FIELDS = {"tensao_v", "corrente_a", "potencia_kw"}

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-5.4-mini"
# A imagem inteira sobe em base64 no corpo da requisição; 1600 px no lado maior
# preserva o texto da plaqueta e mantém o payload em poucos MB.
MAX_SIDE = 1600
TIMEOUT_S = 90

_SYSTEM = (
    "Você é um sistema de OCR especializado em plaquetas de motores elétricos "
    "WEG W22. Responde SEMPRE com um único objeto JSON válido, sem markdown e "
    "sem texto fora do JSON."
)

_PROMPT = """\
Analise esta plaqueta de motor elétrico WEG W22 e extraia os campos abaixo.
Retorne APENAS JSON válido (sem markdown, sem texto extra) com estas chaves — \
use null se não conseguir ler o campo:
{
  "tensao_v": ["220", "380"],
  "corrente_a": ["12.9", "7.50"],
  "potencia_kw": "3.0",
  "rpm": "1690",
  "numero_serie": "1024734282",
  "frequencia_hz": "60",
  "grau_protecao": "55",
  "regime_servico": "S1",
  "peso_kg": "21",
  "fator_servico": "1.00"
}
Regras:
- todo valor escalar é STRING (use "3.0", não 3.0)
- tensao_v e corrente_a são listas de strings (um valor por nível de tensão Y/D)
- potencia_kw é string numérica sem unidade
- numero_serie tem 10 dígitos
- grau_protecao: somente os dois dígitos (ex: "55" para IP55)
- Não invente valores; use null se incerto
"""

_PROMPT_FULL = """\
Você é um sistema OCR especializado em plaquetas de motores elétricos WEG W22.
Analise a imagem e extraia TODOS os campos abaixo.
Retorne APENAS JSON válido (sem markdown, sem texto extra).
Use null para qualquer campo que não consiga ler com confiança.

Esquema obrigatório (retorne EXATAMENTE estas chaves):
{
  "data_fabricacao": "15MAI2023",
  "numero_serie": "1234567890",
  "codigo_produto": "BM12345",
  "potencia_kw": "3.0",
  "potencia_cv": "4.0",
  "tensao_v": ["220", "380"],
  "corrente_a": ["12.9", "7.50"],
  "frequencia_hz": "60",
  "rpm": "1690",
  "fator_servico": "1.00",
  "constante_partida": "6.5",
  "fator_potencia": "0.82",
  "categoria": "N",
  "classe_isolamento": "F",
  "elevacao_temp_k": "80",
  "grau_protecao": "55",
  "carcaca": "100L",
  "regime_servico": "S1",
  "temperatura_ambiente_c": "40",
  "altitude_m": "1000",
  "rendimento_pct": "86.5",
  "classe_eficiencia": "IE3",
  "tipo_motor_desc": "SQUIRREL CAGE",
  "rolamento_dianteiro": "6205-ZZ",
  "rolamento_traseiro": "6205-ZZ",
  "norma": "NBR 17094",
  "peso_kg": "21",
  "selos": ["INMETRO", "PROCEL"]
}

Regras de domínio:
- todo valor escalar é STRING (use "3.0", não 3.0)
- tensao_v e corrente_a: listas de strings, uma por nível de tensão (Y/Delta)
- selos: lista de strings (subconjunto de ["INMETRO", "PROCEL", "CE"]); [] se nenhum visível
- grau_protecao: apenas os dois dígitos após IP (ex: "55" para IP55)
- data_fabricacao: formato DDMMMAAAA, mês em português (ex: "15MAI2023"); null se ilegível
- classe_eficiencia: somente "IE1", "IE2", "IE3" ou "IE4"
- categoria: somente "N", "D" ou "H"
- classe_isolamento: somente "B", "F" ou "H"
- regime_servico: formato "S1" a "S9"
- Não invente valores; use null se incerto
"""


def _to_data_url(img: Image.Image) -> str:
    """PNG em data URL, reduzido quando a foto vem grande demais do celular."""
    work = img
    if max(work.size) > MAX_SIDE:
        scale = MAX_SIDE / max(work.size)
        work = work.resize((int(work.width * scale), int(work.height * scale)), Image.LANCZOS)
    buf = BytesIO()
    work.convert("RGB").save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _stringify(val: Any) -> Any:
    """
    O modelo às vezes devolve número onde o esquema pede string (3.0 em vez de
    "3.0"). O resto do pipeline — normalizador, validador físico e o mapa para
    `MotorNameplate` no front — trabalha em cima de string, então a coerção
    acontece aqui, na fronteira.
    """
    if isinstance(val, bool):
        return str(val)
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, list):
        return [_stringify(v) for v in val if v is not None]
    return val


# Campos em que a contagem de itens importa: o tipo de motor (trifásico vs
# monofásico) e o alerta "qtd de tensões ≠ qtd de correntes" saem do tamanho
# dessas listas.
_MULTI_LEVEL_FIELDS = {"tensao_v", "corrente_a"}


def _explode_levels(val: Any) -> Any:
    """
    "220/380/440" → ["220", "380", "440"].

    O modelo às vezes junta os níveis de tensão numa string só, do jeito que
    estão impressos na plaqueta. A barra é separador; o hífen NÃO é — em placa
    monofásica "220-440" é um valor só, e é justamente ele que faz
    `_infer_motor_type` reconhecer o motor como monofásico.
    """
    items = val if isinstance(val, list) else [val]
    out: list[str] = []
    for item in items:
        text = str(item).strip()
        parts = [p.strip() for p in text.split("/") if p.strip()]
        out.extend(parts or [text])
    return out


def _coerce(field: str, val: Any) -> Any:
    return _explode_levels(_stringify(val)) if field in _MULTI_LEVEL_FIELDS else _stringify(val)


class VlmFallback:
    """Extração por visão via OpenAI — usada como fallback ou como modo próprio."""

    @staticmethod
    def _api_key() -> str | None:
        return os.getenv("OPENAI_API_KEY")

    @staticmethod
    def model() -> str:
        return os.getenv("OPENAI_VISION_MODEL") or DEFAULT_MODEL

    @staticmethod
    def available() -> bool:
        return bool(os.getenv("OPENAI_API_KEY"))

    def needs_fallback(self, fields: dict) -> bool:
        return any(f not in fields for f in CRITICAL_FIELDS)

    # ─── Chamada crua ────────────────────────────────────────────────────────
    def _ask(self, prompt: str, img: Image.Image) -> dict:
        api_key = self._api_key()
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY não definida")

        payload = {
            "model": self.model(),
            "messages": [
                {"role": "system", "content": _SYSTEM},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": _to_data_url(img), "detail": "high"},
                        },
                    ],
                },
            ],
            "response_format": {"type": "json_object"},
            "max_completion_tokens": 2000,
        }

        resp = requests.post(
            OPENAI_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=TIMEOUT_S,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"OpenAI {resp.status_code}: {resp.text[:300]}")

        raw = (resp.json()["choices"][0]["message"]["content"] or "").strip()

        # Cinto e suspensório: mesmo com response_format=json_object, um modelo
        # trocado pelo env pode insistir no bloco markdown.
        code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if code_block:
            raw = code_block.group(1)

        return json.loads(raw)

    # ─── Fallback: só os campos críticos que faltaram ────────────────────────
    def extract(self, img: Image.Image, existing_fields: dict) -> dict[str, Any]:
        """
        Chama o modelo de visão para recuperar campos ausentes.
        Retorna apenas campos novos (não sobrescreve os já extraídos pelo pipeline).
        """
        missing = [f for f in CRITICAL_FIELDS if f not in existing_fields]
        if not missing:
            return {}

        try:
            parsed = self._ask(_PROMPT, img)

            conf = 0.72  # menor que bbox (0.85) e full-text (0.80)
            result: dict[str, Any] = {}
            for field, val in parsed.items():
                if val is None or field in existing_fields:
                    continue
                result[field] = {"value": _coerce(field, val), "confidence": conf}

            logger.info(
                f"VLM fallback ({self.model()}): extraiu {list(result.keys())} "
                f"(campos críticos ausentes: {missing})"
            )
            return result

        except Exception as exc:
            logger.warning(f"VLM fallback falhou: {exc}")
            return {}

    # ─── Modo próprio: a placa inteira direto no modelo de visão ─────────────
    def extract_all(self, img: Image.Image) -> dict[str, Any]:
        """Extrai todos os 28 campos diretamente da imagem (mode='gpt').
        Propaga exceções para o chamador tratar com mensagem adequada."""
        parsed = self._ask(_PROMPT_FULL, img)

        conf = 0.82
        result: dict[str, Any] = {}
        for field, val in parsed.items():
            if val is None:
                continue
            if isinstance(val, list) and len(val) == 0:
                continue
            result[field] = {"value": _coerce(field, val), "confidence": conf}

        logger.info(f"VLM ({self.model()}) full extraction: extraiu {list(result.keys())}")
        return result


# Nome antigo, mantido para não quebrar import de script/notebook fora do repo.
GeminiFallback = VlmFallback
