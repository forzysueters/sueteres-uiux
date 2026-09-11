import os, json
from datetime import date
import uuid as uuid_lib
from PIL import Image


def save_result(image: Image.Image, result: dict) -> str:
    image_id = result.get("image_id", str(uuid_lib.uuid4()))
    today = date.today().isoformat()
    base = os.path.join("storage", today, image_id)
    os.makedirs(base, exist_ok=True)
    image.save(os.path.join(base, "input.jpg"), quality=90)
    with open(os.path.join(base, "output.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return image_id
