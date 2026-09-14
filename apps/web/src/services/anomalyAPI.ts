import axios, { AxiosError, AxiosInstance } from 'axios'

/**
 * Cliente do serviço de detecção de anomalia de motores (FastAPI em `services/anomaly`).
 *
 * Backend: `uvicorn src.api.main:app` → http://localhost:8001
 * Endpoint principal: POST /anomaly/score  (JSON: janela de leituras de um ativo)
 *
 * Espelha o padrão de `ocrAPI.ts`. Configure a URL via VITE_ANOMALY_API_URL no .env.
 */
const ANOMALY_API_URL =
  import.meta.env.VITE_ANOMALY_API_URL || 'http://localhost:8001'

export type Severity = 'ok' | 'info' | 'alerta' | 'critico'

// Tipos espelhando services/anomaly/src/schemas.py.
export interface Reading {
  timestamp: string
  sensors: Record<string, number>
}

export type Channel = 'velocity' | 'acceleration' | 'temperature'

export interface ChannelLimit {
  warn: number
  crit: number
  direction: 'above' | 'below'
}

export interface ScoreRequest {
  asset_tag?: string
  readings: Reading[]
  /** Com limites, o diagnóstico sai do classificador supervisionado. */
  limits?: Partial<Record<Channel, ChannelLimit>>
}

export interface ScoreResponse {
  asset_tag?: string | null
  timestamp: string
  health_index: number // 0-100 (maior = mais saudável)
  health_min: number
  anomaly_score: number // 0-1 no ponto atual
  severity: Severity
  insight: string
  thermal_residual?: number | null
  sustained: boolean
  model_used?: 'classifier' | 'baseline'
  model_version?: string | null
  probabilities?: Partial<Record<Severity, number>> | null
  confidence?: number | null
  rul_days?: number | null
}

/**
 * Resultado consumido pela UI. `modelUsed` é `'mock'` quando o backend está
 * offline e o frontend cai no fallback simulado (ver `apiService`).
 */
export type ScoreResult = ScoreResponse & {
  modelUsed: 'anomaly' | 'mock'
}

export class AnomalyNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnomalyNetworkError'
  }
}

class AnomalyAPI {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: ANOMALY_API_URL,
      timeout: 30_000,
    })
  }

  /** GET /health — verifica se o modelo está carregado. */
  async health(): Promise<{
    status: string
    service: string
    version: string
    model_loaded: boolean
    model_trained_at?: string | null
  }> {
    const { data } = await this.client.get('/health')
    return data
  }

  /**
   * POST /anomaly/score — envia a janela de leituras e retorna o diagnóstico.
   * @throws AnomalyNetworkError se o backend estiver inacessível.
   */
  async score(req: ScoreRequest): Promise<ScoreResponse> {
    try {
      const { data } = await this.client.post<ScoreResponse>(
        '/anomaly/score',
        req,
      )
      return data
    } catch (error) {
      const err = error as AxiosError<{ detail?: string }>
      if (!err.response) {
        throw new AnomalyNetworkError(
          `Não foi possível conectar ao serviço de anomalia em ${ANOMALY_API_URL}. ` +
            'Inicie o backend: uvicorn src.api.main:app --port 8001 (pasta anomaly/).',
        )
      }
      const detail =
        err.response.data?.detail ||
        `Falha no scoring de anomalia (HTTP ${err.response.status})`
      throw new Error(detail)
    }
  }
}

export const anomalyAPI = new AnomalyAPI()
export { ANOMALY_API_URL }
