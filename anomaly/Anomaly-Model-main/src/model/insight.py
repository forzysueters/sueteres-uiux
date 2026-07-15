"""Gerador de texto de insight preditivo (baseado em regras).

Traduz o resultado numérico de ``score_health`` numa frase acionável, para alimentar
o componente "insight preditivo de IA" do frontend do Forzy. Sem LLM: determinístico,
auditável e sem dependência externa.
"""
from __future__ import annotations

from .baseline import SEVERITY_ALERTA, SEVERITY_CRITICO, SEVERITY_INFO, SEVERITY_OK

_ACAO = {
    SEVERITY_OK: "Nenhuma ação necessária.",
    SEVERITY_INFO: "Acompanhar nas próximas leituras.",
    SEVERITY_ALERTA: "Agendar inspeção preventiva.",
    SEVERITY_CRITICO: "Acionar a manutenção com prioridade.",
}


def build_insight(result: dict, baseline: dict) -> str:
    """Monta o texto de insight a partir do dicionário de ``score_health``."""
    sev = result["severity"]
    health = result["health_index"]
    reasons: list[str] = []

    if result["thermal_penalty"] > 0:
        resid = result["residuals"]
        delta = float(resid.iloc[-1]) if len(resid) else 0.0
        reasons.append(
            f"resíduo térmico de {delta:+.1f}°C acima do esperado para a carga "
            "(aquecimento não explicado)"
        )
    if result["anomaly_score"] > 0:
        reasons.append("padrão de operação atípico frente à linha de base saudável")

    if sev == SEVERITY_OK and not reasons:
        return (
            f"Operação dentro do padrão (saúde {health:.0f}/100). "
            "Nenhum desvio relevante detectado."
        )

    motivo = "; ".join(reasons) if reasons else "leve desvio em relação à linha de base"
    prefixo = {
        SEVERITY_CRITICO: "Degradação crítica",
        SEVERITY_ALERTA: "Desvio relevante",
        SEVERITY_INFO: "Desvio leve",
        SEVERITY_OK: "Desvio pontual",
    }[sev]

    sustentado = " de forma sustentada" if result.get("sustained") else ""
    return (
        f"{prefixo}{sustentado} (saúde {health:.0f}/100): {motivo}. "
        f"{_ACAO[sev]}"
    )
