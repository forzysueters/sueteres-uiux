"""
Avalia o pipeline OCR nas imagens reais de placas WEG W22.
Uso: python scripts/eval_real_images.py [--dir data/raw/w22_real]
"""
import sys
import io
import time
import argparse
from pathlib import Path

# Força UTF-8 no stdout do Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from PIL import Image
from src.preprocessing.image_enhancer import adaptive_enhance, assess_quality
from src.postprocessing.field_extractor import FieldExtractor
from src.postprocessing.validator import PhysicalValidator
from src.postprocessing.vlm_fallback import GeminiFallback
from src.api.main import _run_easyocr_on_image, _infer_motor_type

CRITICAL = {"tensao_v", "corrente_a", "potencia_kw", "rpm", "numero_serie"}
SUPPORTED = {".jpg", ".jpeg", ".png", ".webp"}

extractor = FieldExtractor()
validator = PhysicalValidator()
gemini = GeminiFallback()


def process_image(path: Path) -> dict:
    t0 = time.time()
    pil = Image.open(path).convert("RGB")

    report = assess_quality(pil)
    pil = adaptive_enhance(pil)

    full_text, bboxes = _run_easyocr_on_image(pil)

    merged_text = extractor.extract_from_full_image(full_text)
    merged_bbox = extractor.extract_from_bboxes(bboxes)
    merged = extractor.merge_zones({0: merged_text, 1: merged_bbox})

    if gemini.available() and gemini.needs_fallback(merged):
        fallback = gemini.extract(pil, merged)
        if fallback:
            merged = extractor.merge_zones({0: merged, 1: fallback})

    merged = validator.normalize(merged)

    motor_type = _infer_motor_type(merged)
    val_result = validator.validate(merged, motor_type=motor_type)

    return {
        "file": path.name,
        "campos": merged,
        "validacao": val_result,
        "motor_type": motor_type,
        "quality": report,
        "raw_text": full_text,
        "n_bboxes": len(bboxes),
        "ms": round((time.time() - t0) * 1000),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", default="data/raw/w22_real")
    parser.add_argument("--show-text", action="store_true", help="Imprime texto OCR bruto")
    args = parser.parse_args()

    images_dir = Path(args.dir)
    images = sorted(p for p in images_dir.iterdir() if p.suffix.lower() in SUPPORTED)

    if not images:
        print(f"Nenhuma imagem encontrada em {images_dir}")
        sys.exit(1)

    print(f"{'='*60}")
    print(f"Avaliando {len(images)} imagens em: {images_dir}")
    print(f"{'='*60}\n")

    summary_rows = []

    for i, path in enumerate(images, 1):
        print(f"[{i}/{len(images)}] {path.name}")
        print(f"  {'-'*50}")

        try:
            r = process_image(path)
            campos = r["campos"]
            q = r["quality"]

            # Diagnóstico de qualidade
            flags = []
            if q.is_blurry:   flags.append(f"desfocada(var={q.laplacian_var:.0f})")
            if q.is_dark:     flags.append(f"escura(mean={q.gray_mean:.0f})")
            if q.low_contrast:flags.append(f"baixo-contraste(std={q.gray_std:.0f})")
            if q.has_glare:   flags.append(f"reflexo({q.glare_pct:.1f}%)")
            quality_str = ", ".join(flags) if flags else "OK"
            print(f"  Qualidade: {quality_str}")
            print(f"  Bboxes detectados: {r['n_bboxes']}  |  Tempo: {r['ms']}ms")

            # Campos extraídos
            n = len(campos)
            critical_found = [f for f in CRITICAL if f in campos]
            print(f"  Campos extraídos: {n}  |  Críticos: {len(critical_found)}/{len(CRITICAL)} {list(critical_found)}")

            for fname in sorted(campos):
                fval = campos[fname]
                val  = fval["value"]
                conf = fval["confidence"]
                marker = "★" if fname in CRITICAL else " "
                print(f"  {marker} {fname:<28} = {val!r:<30} conf={conf:.2f}")

            # Validação
            if r["validacao"]["alertas"]:
                for alerta in r["validacao"]["alertas"]:
                    print(f"  ⚠  {alerta}")
            else:
                print(f"  ✓ Validação física OK  ({r['motor_type']})")

            if args.show_text:
                print(f"\n  --- OCR raw ---\n{r['raw_text']}\n  ---------------")

            summary_rows.append((path.name, n, len(critical_found), r["validacao"]["consistente"]))

        except Exception as e:
            import traceback
            print(f"  ERRO: {e}")
            traceback.print_exc()
            summary_rows.append((path.name, 0, 0, False))

        print()

    # Resumo final
    print(f"{'='*60}")
    print(f"{'RESUMO':^60}")
    print(f"{'='*60}")
    print(f"{'Imagem':<45} {'Campos':>6} {'Crít':>5} {'Válido':>7}")
    print(f"{'-'*60}")
    for name, n_campos, n_crit, valido in summary_rows:
        ok = "✓" if valido else "✗"
        print(f"{name:<45} {n_campos:>6} {n_crit:>5}/{len(CRITICAL)} {ok:>7}")
    print(f"{'-'*60}")
    avg_campos = sum(r[1] for r in summary_rows) / len(summary_rows)
    avg_crit   = sum(r[2] for r in summary_rows) / len(summary_rows)
    n_valid    = sum(1 for r in summary_rows if r[3])
    print(f"{'Média':<45} {avg_campos:>6.1f} {avg_crit:>5.1f}/{len(CRITICAL)}")
    print(f"Imagens com validação física OK: {n_valid}/{len(images)}")


if __name__ == "__main__":
    main()
