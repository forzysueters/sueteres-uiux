import time, uuid, logging
from contextlib import asynccontextmanager
from io import BytesIO
from typing import Literal
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from dotenv import load_dotenv
load_dotenv()
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from src.api.schemas import OCRResponse, HealthResponse, FieldValue, ValidationResult
from src.api.storage import save_result
from src.preprocessing.image_enhancer import enhance_image, adaptive_enhance
from src.preprocessing.plate_corrector import correct_perspective
from src.postprocessing.field_extractor import FieldExtractor
from src.postprocessing.validator import PhysicalValidator
from src.postprocessing.vlm_fallback import VlmFallback

logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s"}',
)
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

_easyocr_reader = None


def _load_easyocr():
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        _easyocr_reader = easyocr.Reader(["en"], gpu=False)
    return _easyocr_reader


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading model: easyocr")
    _load_easyocr()
    yield


app = FastAPI(title="WEG W22 OCR API", version="1.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

extractor = FieldExtractor()
validator = PhysicalValidator()
vlm = VlmFallback()


def _invert_if_dark(img: Image.Image) -> Image.Image:
    import numpy as np
    gray = np.array(img.convert("L"))
    if gray.mean() < 100:
        return Image.fromarray(255 - np.array(img))
    return img


def _remove_grid_lines(img: Image.Image) -> Image.Image:
    import cv2
    import numpy as np
    arr = np.array(img)
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY) if arr.ndim == 3 else arr.copy()

    # Inverte para que texto/linhas fiquem brancos (mais fácil trabalhar)
    inv = cv2.bitwise_not(gray)

    # Linhas horizontais: estruturas longas e finas na horizontal
    h_len = max(40, gray.shape[1] // 8)
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_len, 1))
    h_lines = cv2.morphologyEx(inv, cv2.MORPH_OPEN, h_kernel)

    # Linhas verticais: estruturas altas e finas na vertical
    v_len = max(20, gray.shape[0] // 10)
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, v_len))
    v_lines = cv2.morphologyEx(inv, cv2.MORPH_OPEN, v_kernel)

    # Remove as linhas detectadas e reconstrói imagem RGB
    lines = cv2.add(h_lines, v_lines)
    cleaned = cv2.bitwise_not(cv2.subtract(inv, lines))
    return Image.fromarray(cv2.cvtColor(cleaned, cv2.COLOR_GRAY2RGB))


def _run_easyocr_on_image(img: Image.Image) -> tuple[str, list[dict]]:
    """Retorna (texto reconstruído por linha, lista de bboxes normalizados [0,1])."""
    reader = _load_easyocr()
    import numpy as np
    img = _invert_if_dark(img)
    img = _remove_grid_lines(img)
    w, h = img.size
    img_scaled = img.resize((w * 2, h * 2), Image.LANCZOS)
    iw, ih = img_scaled.size
    arr = np.array(img_scaled)
    results = reader.readtext(arr)
    if not results:
        return "", []

    def _y_mid(r):
        bbox = r[0]
        return (bbox[0][1] + bbox[2][1]) / 2

    def _to_bbox_dict(r) -> dict:
        pts = r[0]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return {
            "text": r[1],
            "conf": float(r[2]),
            "x0": min(xs) / iw,
            "y0": min(ys) / ih,
            "x1": max(xs) / iw,
            "y1": max(ys) / ih,
        }

    sorted_by_y = sorted(results, key=_y_mid)
    rows, cur = [], [sorted_by_y[0]]
    for item in sorted_by_y[1:]:
        if abs(_y_mid(item) - _y_mid(cur[0])) <= 15:
            cur.append(item)
        else:
            rows.append(cur)
            cur = [item]
    rows.append(cur)

    lines = []
    for row in rows:
        row.sort(key=lambda r: r[0][0][0])
        lines.append(" ".join(item[1] for item in row))

    bboxes = [_to_bbox_dict(r) for r in results]
    return "\n".join(lines), bboxes


def _infer_motor_type(fields: dict) -> str:
    tensao = fields.get("tensao_v", {}).get("value", [])
    if isinstance(tensao, list) and any("-" in str(v) for v in tensao):
        return "monofasico"
    if isinstance(tensao, list) and len(tensao) >= 3:
        return "trifasico"
    return "desconhecido"


@app.get("/health", response_model=HealthResponse)
async def health():
    vlm_ok = "disponivel" if vlm.available() else "sem_chave"
    return HealthResponse(status="ok", model_loaded=f"easyocr+gpt:{vlm_ok} ({vlm.model()})")


@app.post("/ocr/extract", response_model=OCRResponse)
async def extract(
    image: UploadFile = File(...),
    # "gemini" continua aceito como apelido de "gpt": o provedor de visão mudou
    # para a OpenAI, mas clientes antigos (e links salvos do /docs) não quebram.
    mode: Literal["easyocr", "gpt", "gemini"] = Query(default="easyocr"),
    return_zones: bool = Query(default=True),
    preprocess: bool = Query(default=False),
):
    t0 = time.time()

    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Formato não suportado: {image.content_type}",
        )

    raw = await image.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Arquivo maior que 10 MB")

    pil = Image.open(BytesIO(raw)).convert("RGB")
    image_id = str(uuid.uuid4())

    # Condicionamento adaptativo sempre ativo (aplica só o que a imagem precisa)
    pil = adaptive_enhance(pil)

    if mode in ("gpt", "gemini"):
        if not vlm.available():
            raise HTTPException(
                status_code=503,
                detail="Modelo de visão indisponível: configure OPENAI_API_KEY no .env",
            )

        try:
            merged = vlm.extract_all(pil)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Modelo de visão falhou: {exc}")

        if not merged:
            raise HTTPException(
                status_code=502,
                detail="O modelo de visão retornou todos os campos nulos. Verifique a qualidade da imagem.",
            )

        merged = validator.normalize(merged)
        motor_type = _infer_motor_type(merged)
        val_result = validator.validate(merged, motor_type=motor_type)
        campos = {k: FieldValue(**v) for k, v in merged.items()}
        ms = round((time.time() - t0) * 1000, 1)

        result = OCRResponse(
            image_id=image_id,
            tipo_motor=motor_type,
            campos=campos,
            raw_text_por_zona={},
            validacao=ValidationResult(**val_result),
            processing_time_ms=ms,
            model_used="gpt",
        )

    else:  # mode == "easyocr"
        # Correção de perspectiva permanece opt-in (pode degradar se mal detectada)
        if preprocess:
            pil = correct_perspective(pil)

        full_text, bboxes = _run_easyocr_on_image(pil)
        zone_texts = {"full_image": full_text}

        # Fusão: bbox (conf 0.85) + full-text (conf 0.80) → campos de maior confiança ganham
        merged_text = extractor.extract_from_full_image(full_text)
        merged_bbox = extractor.extract_from_bboxes(bboxes)
        merged = extractor.merge_zones({0: merged_text, 1: merged_bbox})

        # VLM fallback quando campos críticos estão ausentes
        if vlm.available() and vlm.needs_fallback(merged):
            fallback = vlm.extract(pil, merged)
            if fallback:
                merged = extractor.merge_zones({0: merged, 1: fallback})

        merged = validator.normalize(merged)
        motor_type = _infer_motor_type(merged)
        val_result = validator.validate(merged, motor_type=motor_type)
        campos = {k: FieldValue(**v) for k, v in merged.items()}
        ms = round((time.time() - t0) * 1000, 1)

        result = OCRResponse(
            image_id=image_id,
            tipo_motor=motor_type,
            campos=campos,
            raw_text_por_zona=zone_texts if return_zones else {},
            validacao=ValidationResult(**val_result),
            processing_time_ms=ms,
            model_used="easyocr",
        )

    save_result(pil, result.model_dump())
    logger.info(f"Extracted {len(campos)} fields in {ms}ms image={image_id} mode={mode}")
    return result
