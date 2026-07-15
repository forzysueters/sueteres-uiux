"""Configuração central do serviço de anomalia.

Todos os limiares vêm do notebook de validação (`notebooks/manutencao_preditiva_motores.ipynb`)
e podem ser sobrescritos por variáveis de ambiente.
"""
import os
from pathlib import Path

# --- Caminhos ---------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = Path(os.getenv("ANOMALY_MODELS_DIR", BASE_DIR / "models"))
DATA_DIR = BASE_DIR / "data"

# --- Serviço ----------------------------------------------------------------
SERVICE_PORT = int(os.getenv("ANOMALY_PORT", "8001"))
# Origens liberadas no CORS (frontend Vite do Forzy por padrão).
CORS_ORIGINS = os.getenv(
    "ANOMALY_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

# --- Processamento de sinal (grade temporal e janelas móveis) ---------------
RESAMPLE_RULE = os.getenv("ANOMALY_RESAMPLE_RULE", "10s")  # grade fixa de reamostragem
FEATURE_WIN = int(os.getenv("ANOMALY_FEATURE_WIN", "12"))  # 12 x 10s = 2 min
DUTY_THRESHOLD = float(os.getenv("ANOMALY_DUTY_THRESHOLD", "1.0"))  # v > 1.0 => operando

# --- Índice de saúde e severidade -------------------------------------------
# Faixas de health (0-100) -> severidade alinhada ao frontend do Forzy.
HEALTH_OK = float(os.getenv("ANOMALY_HEALTH_OK", "85"))       # >= ok
WARN_LEVEL = float(os.getenv("ANOMALY_WARN_LEVEL", "65"))     # < warn  => alerta
CRIT_LEVEL = float(os.getenv("ANOMALY_CRIT_LEVEL", "45"))     # < crit  => critico
# Persistência (nº de amostras de 10s abaixo do warn) p/ considerar alerta sustentado.
PERSIST_SAMPLES = int(os.getenv("ANOMALY_PERSIST_SAMPLES", "18"))  # ~3 min

# Suavizador exponencial do índice de saúde.
HEALTH_EWM_ALPHA = float(os.getenv("ANOMALY_HEALTH_EWM_ALPHA", "0.03"))

MODELS_DIR.mkdir(parents=True, exist_ok=True)
