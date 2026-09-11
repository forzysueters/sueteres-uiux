import cv2
import numpy as np
from PIL import Image


def _order_points(pts: np.ndarray) -> np.ndarray:
    """Ordena 4 pontos: TL, TR, BR, BL."""
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def detect_plate_contour(arr: np.ndarray) -> np.ndarray | None:
    gray = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)
    edges = cv2.dilate(edges, None, iterations=2)
    cnts, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cnts = sorted(cnts, key=cv2.contourArea, reverse=True)[:5]
    for c in cnts:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            return _order_points(approx.reshape(4, 2))
    return None


def correct_perspective(img: Image.Image,
                        target_w: int = 520,
                        target_h: int = 310) -> Image.Image:
    arr = np.array(img.convert("RGB"))
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    pts = detect_plate_contour(bgr)

    if pts is None:
        resized = cv2.resize(bgr, (target_w, target_h))
        return Image.fromarray(cv2.cvtColor(resized, cv2.COLOR_BGR2RGB))

    dst = np.float32([
        [0, 0], [target_w, 0], [target_w, target_h], [0, target_h]
    ])
    M = cv2.getPerspectiveTransform(pts.astype(np.float32), dst)
    warped = cv2.warpPerspective(bgr, M, (target_w, target_h))
    return Image.fromarray(cv2.cvtColor(warped, cv2.COLOR_BGR2RGB))
