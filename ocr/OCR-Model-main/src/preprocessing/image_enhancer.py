import cv2
import numpy as np
from dataclasses import dataclass
from PIL import Image


@dataclass
class QualityReport:
    laplacian_var: float
    gray_mean: float
    gray_std: float
    glare_pct: float

    @property
    def is_blurry(self) -> bool:
        return self.laplacian_var < 50.0

    @property
    def is_dark(self) -> bool:
        return self.gray_mean < 80.0

    @property
    def low_contrast(self) -> bool:
        return self.gray_std < 30.0

    @property
    def has_glare(self) -> bool:
        return self.glare_pct > 5.0


def detect_saturated_regions(img: Image.Image, threshold: int = 240) -> np.ndarray:
    arr = np.array(img.convert("RGB"))
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    _, mask = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    return cv2.dilate(mask, kernel, iterations=2)


def _gamma_correction(bgr: np.ndarray, gamma: float = 1.5) -> np.ndarray:
    inv_gamma = 1.0 / gamma
    table = np.uint8((np.arange(256) / 255.0) ** inv_gamma * 255)
    return cv2.LUT(bgr, table)


def assess_quality(img: Image.Image) -> QualityReport:
    gray = np.array(img.convert("L"))
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    gray_mean = float(gray.mean())
    gray_std = float(gray.std())
    glare_pct = float((gray > 240).mean() * 100)
    return QualityReport(laplacian_var, gray_mean, gray_std, glare_pct)


def adaptive_enhance(img: Image.Image) -> Image.Image:
    """Aplica processamento seletivo com base em diagnóstico de qualidade da imagem."""
    report = assess_quality(img)
    arr = np.array(img.convert("RGB"))
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    changed = False

    # Escura → gamma correction (menos agressivo que CLAHE em imagens bem expostas)
    if report.is_dark:
        bgr = _gamma_correction(bgr, gamma=1.5)
        changed = True
    # Baixo contraste (mas não escura) → CLAHE seletivo
    elif report.low_contrast:
        lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        bgr = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
        changed = True

    # Reflexo/superexposição → inpaint apenas na região afetada
    if report.has_glare:
        rgb_tmp = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        sat_mask = detect_saturated_regions(Image.fromarray(rgb_tmp))
        if sat_mask.any():
            bgr = cv2.inpaint(bgr, sat_mask, 5, cv2.INPAINT_NS)
            changed = True

    # Desfocada → unsharp mask seletivo
    if report.is_blurry:
        blur = cv2.GaussianBlur(bgr, (0, 0), 1.5)
        bgr = cv2.addWeighted(bgr, 1.5, blur, -0.5, 0)
        changed = True

    if not changed:
        return img

    return Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))


def enhance_image(img: Image.Image) -> Image.Image:
    """Aplica todos os processos incondicionalmente (legado)."""
    arr = np.array(img.convert("RGB"))
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)

    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    bgr = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

    bgr = cv2.fastNlMeansDenoisingColored(bgr, None, 6, 6, 7, 21)

    rgb_for_mask = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    sat_mask = detect_saturated_regions(Image.fromarray(rgb_for_mask))
    if sat_mask.any():
        bgr = cv2.inpaint(bgr, sat_mask, 5, cv2.INPAINT_NS)

    blur = cv2.GaussianBlur(bgr, (0, 0), 2.0)
    bgr = cv2.addWeighted(bgr, 1.4, blur, -0.4, 0)

    return Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
