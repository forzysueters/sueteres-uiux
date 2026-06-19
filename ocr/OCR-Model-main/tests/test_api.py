import io
import pytest
from httpx import AsyncClient, ASGITransport
from PIL import Image
from unittest.mock import patch


@pytest.fixture
def sample_image_bytes():
    img = Image.new("RGB", (520, 310), (200, 200, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.read()


def _make_app():
    """Import app with model loading patched out so tests don't need PaddleOCR."""
    import src.api.main as m
    return m.app


@pytest.mark.asyncio
async def test_health_endpoint():
    app = _make_app()
    # Patch lifespan model loading
    with patch("src.api.main._load_easyocr"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "model_loaded" in data


@pytest.mark.asyncio
async def test_extract_returns_json_schema(sample_image_bytes):
    app = _make_app()
    # Patch OCR runner to return empty string (no model needed)
    with patch("src.api.main._load_easyocr"), \
         patch("src.api.main._run_easyocr_on_image", return_value=("", [])), \
         patch("src.api.main.save_result"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.post(
                "/ocr/extract",
                files={"image": ("test.jpg", sample_image_bytes, "image/jpeg")},
            )
    assert r.status_code == 200
    data = r.json()
    assert "image_id" in data
    assert "campos" in data
    assert "validacao" in data
    assert "processing_time_ms" in data


@pytest.mark.asyncio
async def test_extract_rejects_oversized(sample_image_bytes):
    app = _make_app()
    big = sample_image_bytes * 3500  # >10 MB (fixture ~3.2 KB, need 3210x)
    with patch("src.api.main._load_easyocr"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.post(
                "/ocr/extract",
                files={"image": ("big.jpg", big, "image/jpeg")},
            )
    assert r.status_code == 413


@pytest.mark.asyncio
async def test_extract_rejects_wrong_format():
    app = _make_app()
    with patch("src.api.main._load_easyocr"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.post(
                "/ocr/extract",
                files={"image": ("doc.pdf", b"%PDF-1.4", "application/pdf")},
            )
    assert r.status_code == 422
