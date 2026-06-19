"""
VLM fallback para campos críticos ausentes após o pipeline OCR principal.
Usa Google Gemini 1.5 Flash (free tier: 15 req/min, 1500 req/day).
Requer variável de ambiente GEMINI_API_KEY.
"""
import json
import logging
import os
import re
from io import BytesIO
from typing import Any

from PIL import Image

logger = logging.getLogger(__name__)

CRITICAL_FIELDS = {"tensao_v", "corrente_a", "potencia_kw"}

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


class GeminiFallback:
    def __init__(self):
        self._model = None

    def _get_model(self):
        if self._model is None:
            import google.generativeai as genai
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise RuntimeError("GEMINI_API_KEY não definida")
            genai.configure(api_key=api_key)
            self._model = genai.GenerativeModel("gemini-3.1-flash-lite")
        return self._model

    @staticmethod
    def available() -> bool:
        return bool(os.getenv("GEMINI_API_KEY"))

    def needs_fallback(self, fields: dict) -> bool:
        return any(f not in fields for f in CRITICAL_FIELDS)

    def extract(self, img: Image.Image, existing_fields: dict) -> dict[str, Any]:
        """
        Chama Gemini para recuperar campos ausentes.
        Retorna apenas campos novos (não sobrescreve os já extraídos pelo pipeline).
        """
        missing = [f for f in CRITICAL_FIELDS if f not in existing_fields]
        if not missing:
            return {}

        try:
            model = self._get_model()
            response = model.generate_content([_PROMPT, img])
            raw = response.text.strip()

            # Remove bloco markdown caso o modelo insista em usá-lo
            code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
            if code_block:
                raw = code_block.group(1)

            parsed: dict = json.loads(raw)

            conf = 0.72  # menor que bbox (0.85) e full-text (0.80)
            result: dict[str, Any] = {}

            for field, val in parsed.items():
                if val is None or field in existing_fields:
                    continue
                result[field] = {"value": val, "confidence": conf}

            logger.info(
                f"Gemini fallback: extraiu {list(result.keys())} "
                f"(campos críticos ausentes: {missing})"
            )
            return result

        except Exception as exc:
            logger.warning(f"Gemini fallback falhou: {exc}")
            return {}

    def extract_all(self, img: Image.Image) -> dict[str, Any]:
        """Extrai todos os 28 campos diretamente da imagem via Gemini (mode='gemini').
        Propaga exceções para o chamador tratar com mensagem adequada."""
        model = self._get_model()
        response = model.generate_content([_PROMPT_FULL, img])
        raw = response.text.strip()

        code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if code_block:
            raw = code_block.group(1)

        parsed: dict = json.loads(raw)

        conf = 0.82
        result: dict[str, Any] = {}
        for field, val in parsed.items():
            if val is None:
                continue
            if isinstance(val, list) and len(val) == 0:
                continue
            result[field] = {"value": val, "confidence": conf}

        logger.info(f"Gemini full extraction: extraiu {list(result.keys())}")
        return result
