"""Treina o classificador supervisionado de severidade a partir do histórico IO-Link aumentado.

Pipeline (mesma narrativa da Sprint 3, agora reprodutível):

1. **Data augmentation** do CSV saudável (``src/model/augment.py``).
2. **Etapa não supervisionada**: K-Means com 4 grupos sobre os atributos das janelas. Os
   grupos são nomeados pela saúde média e comparados com o rótulo normativo — é a checagem
   de que as quatro classes existem na estrutura dos dados, e não só na regra.
3. **Rotulagem**: rótulo final pela régua normativa (ISO 10816-3 + isolamento classe F),
   a mesma do cenário simulado da migração 0018.
4. **Supervisionado**: HistGradientBoosting para a severidade e para o Índice de Saúde.
5. **Avaliação**: holdout estratificado, generalização para o motor não visto (m2) e
   concordância com os perfis do cenário da planta.

    python train_classifier.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime, timezone

import numpy as np
from sklearn.cluster import KMeans
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.metrics import (
    accuracy_score,
    adjusted_rand_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from src.config import DATA_DIR, MODELS_DIR
from src.data_loader import load_iolink_csv
from src.model.augment import SCENARIO_POSITION, build_dataset, real_windows, scenario_windows
from src.model.classifier import FEATURE_NAMES, save_classifier, window_features
from src.model.normative import SEVERITIES, teacher

VERSION = "2.0.0"
SEED = 42


def _fit(X, y, h):
    clf = HistGradientBoostingClassifier(
        max_iter=400, learning_rate=0.08, max_leaf_nodes=31, l2_regularization=1e-3,
        random_state=SEED,
    ).fit(X, y)
    reg = HistGradientBoostingRegressor(
        max_iter=400, learning_rate=0.08, max_leaf_nodes=31, random_state=SEED,
    ).fit(X, h)
    return clf, reg


def _unsupervised_stage(X: np.ndarray, y: np.ndarray, health: np.ndarray) -> dict:
    rng = np.random.default_rng(SEED)
    idx = rng.choice(len(X), size=min(12000, len(X)), replace=False)
    Xs = StandardScaler().fit_transform(X[idx])
    km = KMeans(n_clusters=4, n_init=10, random_state=SEED).fit(Xs)
    order = np.argsort([-health[idx][km.labels_ == k].mean() for k in range(4)])
    cluster_to_sev = {int(k): int(rank) for rank, k in enumerate(order)}
    mapped = np.array([cluster_to_sev[int(k)] for k in km.labels_])
    return {
        "algorithm": "KMeans(k=4) sobre atributos padronizados",
        "amostras": int(len(idx)),
        "ari_vs_rotulo_normativo": round(float(adjusted_rand_score(y[idx], km.labels_)), 3),
        "concordancia_grupo_nomeado": round(float(accuracy_score(y[idx], mapped)), 3),
        "saude_media_por_grupo": {
            SEVERITIES[cluster_to_sev[k]]: round(float(health[idx][km.labels_ == k].mean()), 1)
            for k in range(4)
        },
    }


def main() -> int:
    csvs = sorted(DATA_DIR.glob("History_*.csv"))
    if not csvs:
        print(f"Nenhum CSV encontrado em {DATA_DIR}", file=sys.stderr)
        return 1
    motors = load_iolink_csv(str(csvs[0]))
    frames = list(motors.values())

    data = build_dataset(frames, n_per_family=4000, seed=SEED)
    W, family = data["windows"], data["family"]
    lab = teacher(W)
    X, y, h = window_features(W), lab["severity"], lab["health"]
    print(f"Janelas aumentadas: {len(W)}  | classes: {dict(Counter(SEVERITIES[i] for i in y))}")

    unsupervised = _unsupervised_stage(X, y, h)
    print("Etapa não supervisionada:", unsupervised)

    X_tr, X_te, y_tr, y_te, h_tr, h_te = train_test_split(
        X, y, h, test_size=0.2, stratify=y, random_state=SEED
    )
    clf, reg = _fit(X_tr, y_tr, h_tr)
    y_hat = clf.predict(X_te)
    holdout = {
        "acuracia": round(float(accuracy_score(y_te, y_hat)), 4),
        "f1_macro": round(float(f1_score(y_te, y_hat, average="macro")), 4),
        "mae_saude": round(float(mean_absolute_error(h_te, reg.predict(X_te))), 3),
        "matriz_confusao": confusion_matrix(y_te, y_hat, labels=[0, 1, 2, 3]).tolist(),
    }

    # Generalização para o motor não visto: treina sem nenhuma janela vinda do m2.
    rng = np.random.default_rng(SEED + 1)
    only_m1 = build_dataset([motors["m1"]], n_per_family=2500, seed=SEED + 2)
    lab_m1 = teacher(only_m1["windows"])
    clf_m1, reg_m1 = _fit(window_features(only_m1["windows"]), lab_m1["severity"], lab_m1["health"])
    W_m2 = real_windows([motors["m2"]], 3000, rng)
    lab_m2 = teacher(W_m2)
    X_m2 = window_features(W_m2)
    motor_nao_visto = {
        "acuracia": round(float(accuracy_score(lab_m2["severity"], clf_m1.predict(X_m2))), 4),
        "mae_saude": round(float(mean_absolute_error(lab_m2["health"], reg_m1.predict(X_m2))), 3),
    }

    # Cenário da planta: o classificador tem de concordar com todos os perfis.
    W_sc = scenario_windows(4000, np.random.default_rng(SEED + 3))
    lab_sc = teacher(W_sc)
    y_sc = clf.predict(window_features(W_sc))
    cenario = {
        "concordancia": round(float(accuracy_score(lab_sc["severity"], y_sc)), 4),
        "por_perfil": {
            p: round(float(np.mean(y_sc[np.isclose(W_sc[:, :, 0].mean(axis=1), pos, atol=0.1)]
                                   == SEVERITIES.index(p))), 4)
            for p, pos in SCENARIO_POSITION.items()
        },
    }

    # Modelo final com todo o conjunto.
    clf, reg = _fit(X, y, h)
    metrics = {"holdout": holdout, "motor_nao_visto": motor_nao_visto, "cenario_planta": cenario,
               "nao_supervisionado": unsupervised}
    trained_at = datetime.now(timezone.utc)
    model = {
        "classifier": clf, "regressor": reg, "feature_names": FEATURE_NAMES,
        "version": VERSION, "trained_at": trained_at.isoformat(), "metrics": metrics,
        "training_rows": int(len(W)), "families": dict(Counter(family.tolist())),
    }
    path = save_classifier(model)

    card = {
        "name": "Classificador de Severidade de Ativos",
        "version": VERSION,
        "algorithm": "HistGradientBoostingClassifier + HistGradientBoostingRegressor",
        "trained_at": trained_at.isoformat(),
        "training_rows": int(len(W)),
        "feature_names": FEATURE_NAMES,
        "augmentation_families": dict(Counter(family.tolist())),
        "metrics": metrics,
        "model_card": {
            "purpose": "Classificar a severidade (ok/info/alerta/crítico) e estimar o Índice de "
                       "Saúde de qualquer ativo a partir da janela de 5 min de velocidade de "
                       "vibração, aceleração e temperatura.",
            "training_data": f"{len(W)} janelas geradas por data augmentation de ~4 h de log "
                             "IO-Link de dois motores do Forzy Lab (recortes reais projetados em "
                             "3 classes de limite ISO, dinâmica real reposicionada, rampa térmica, "
                             "deriva de vibração, picos, perda de amostras, canal ausente, "
                             "distorção temporal e o cenário simulado da planta).",
            "labeling": "Etapa não supervisionada (K-Means, 4 grupos) confirma a estrutura; o "
                        "rótulo final vem da régua normativa ISO 10816-3 / isolamento classe F, "
                        "a mesma do avaliador da migração 0018.",
            "limitations": "Não há falha real rotulada: o modelo aprende a régua normativa sobre "
                           "dinâmicas reais e degradações injetadas, não modos de falha observados. "
                           "RUL é heurística derivada da saúde.",
            "biases": "Dinâmica de base vem de dois motores de bancada em 4 h de uma sessão; "
                      "regimes de partida e cargas diferentes estão sub-representados.",
            "intended_use": "Triagem de condição para priorizar inspeção humana.",
            "out_of_scope": "Diagnóstico de causa raiz ou parada automática de produção.",
        },
    }
    (MODELS_DIR / "model_card.json").write_text(json.dumps(card, ensure_ascii=False, indent=2),
                                                encoding="utf-8")
    print(json.dumps({k: v for k, v in metrics.items() if k != "nao_supervisionado"},
                     ensure_ascii=False, indent=2))
    print(f"Modelo salvo em {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
