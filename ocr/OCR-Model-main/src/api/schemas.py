from pydantic import BaseModel
from typing import Any, Literal


class FieldValue(BaseModel):
    value: Any
    confidence: float
    value_iso: str | None = None


class ValidationResult(BaseModel):
    consistente: bool
    alertas: list[str]


class OCRResponse(BaseModel):
    image_id: str
    fabricante: str = "WEG"
    linha: str = "W22"
    tipo_motor: Literal["monofasico", "trifasico", "desconhecido"]
    campos: dict[str, FieldValue]
    raw_text_por_zona: dict[str, str]
    validacao: ValidationResult
    processing_time_ms: float
    model_used: Literal["paddleocr", "trocr", "easyocr", "gpt", "gemini"]

    @classmethod
    def empty(cls, image_id: str, model: str, ms: float) -> "OCRResponse":
        return cls(
            image_id=image_id,
            tipo_motor="desconhecido",
            campos={},
            raw_text_por_zona={},
            validacao=ValidationResult(consistente=False, alertas=["Nenhum campo extraído"]),
            processing_time_ms=ms,
            model_used=model,
        )


class HealthResponse(BaseModel):
    status: str
    model_loaded: str
    version: str = "1.1.0"
