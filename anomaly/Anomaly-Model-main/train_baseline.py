"""Treina o modelo único de anomalia a partir do histórico saudável em ``data/``.

Empilha os dois motores do CSV IO-Link como exemplos de operação normal de "um motor" e
salva o baseline em ``models/baseline.joblib`` — o artefato que o serviço carrega para
pontuar qualquer ativo. Rode uma vez (e sempre que o dado de referência mudar):

    python train_baseline.py
"""
from __future__ import annotations

import sys

from src.config import DATA_DIR
from src.data_loader import load_iolink_csv
from src.model.baseline import fit_baseline
from src.model.persistence import DEFAULT_BASELINE_PATH, save_baseline


def main() -> int:
    csvs = sorted(DATA_DIR.glob("History_*.csv"))
    if not csvs:
        print(f"Nenhum CSV encontrado em {DATA_DIR}", file=sys.stderr)
        return 1
    csv = csvs[0]
    print(f"Treinando a partir de: {csv.name}")

    motors = load_iolink_csv(str(csv))            # {'m1': <frame>, 'm2': <frame>}
    segments = list(motors.values())              # m1 e m2 empilhados como operação normal
    baseline = fit_baseline(segments, label="motor-iolink")

    path = save_baseline(baseline)
    print(
        f"Modelo salvo em {path}\n"
        f"  segmentos    : {baseline['n_segments']} (m1 + m2)\n"
        f"  amostras     : {baseline['n_samples']}\n"
        f"  canais       : {baseline['channels']}\n"
        f"  modelo térmico: {baseline['thermal'] is not None}\n"
        f"  fronteira    : {baseline['cal']['ref']:.4f}"
    )
    assert path == DEFAULT_BASELINE_PATH
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
