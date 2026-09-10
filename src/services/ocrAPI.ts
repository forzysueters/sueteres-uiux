import axios, { AxiosError, AxiosInstance } from 'axios'
import { MotorNameplate } from '../types'

/**
 * Cliente do modelo de OCR WEG W22 (FastAPI — pasta `ocr/`).
 *
 * Backend: `uvicorn src.api.main:app` → http://localhost:8000
 * Endpoint principal: POST /ocr/extract  (multipart: image)
 *
 * Configure a URL via VITE_OCR_API_URL no .env do frontend.
 */
const OCR_API_URL =
  import.meta.env.VITE_OCR_API_URL || 'http://localhost:8000'

export type OcrMode = 'easyocr' | 'gpt'

// ─── Tipos espelhando src/api/schemas.py do modelo ──────────────────────────
export interface FieldValue {
  value: unknown
  confidence: number
  value_iso?: string | null
}

export interface ValidationResult {
  consistente: boolean
  alertas: string[]
}

export interface OCRResponse {
  image_id: string
  fabricante: string
  linha: string
  tipo_motor: 'monofasico' | 'trifasico' | 'desconhecido'
  campos: Record<string, FieldValue>
  raw_text_por_zona: Record<string, string>
  validacao: ValidationResult
  processing_time_ms: number
  model_used: 'paddleocr' | 'trocr' | 'easyocr' | 'gpt' | 'gemini'
}

/** Resultado já mapeado para a UI, com os metadados do pipeline. */
export interface NameplateExtraction {
  nameplate: Partial<MotorNameplate>
  validation: ValidationResult
  modelUsed: OCRResponse['model_used']
  motorType: OCRResponse['tipo_motor']
  processingTimeMs: number
  rawFields: Record<string, FieldValue>
}

/**
 * Resultado consumido pela UI. `modelUsed` pode ser `'mock'` quando o backend
 * está offline e o frontend cai no fallback simulado (ver `apiService`).
 */
export type NameplateResult = Omit<NameplateExtraction, 'modelUsed'> & {
  modelUsed: NameplateExtraction['modelUsed'] | 'mock'
}

export class OcrNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OcrNetworkError'
  }
}

// ─── Helpers de conversão dos campos do OCR → MotorNameplate ─────────────────
const asString = (f?: FieldValue): string | undefined => {
  if (!f || f.value == null) return undefined
  if (Array.isArray(f.value)) return f.value.join('/')
  return String(f.value)
}

const asNumber = (f?: FieldValue): number | undefined => {
  if (!f || f.value == null) return undefined
  const raw = Array.isArray(f.value) ? f.value[0] : f.value
  const n = parseFloat(String(raw).replace(',', '.').split('-')[0])
  return Number.isFinite(n) ? n : undefined
}

/** Estima o número de polos a partir de RPM e frequência (motor de indução). */
const estimatePoles = (rpm?: number, hz?: number): number | undefined => {
  if (!rpm || !hz) return undefined
  const candidate = (120 * hz) / rpm
  const even = Math.max(2, Math.round(candidate / 2) * 2)
  return even
}

/** Confiança média (0-100) ponderada por todos os campos extraídos. */
const averageConfidence = (campos: Record<string, FieldValue>): number => {
  const vals = Object.values(campos)
    .map((f) => f.confidence)
    .filter((c) => typeof c === 'number')
  if (vals.length === 0) return 0
  const avg = vals.reduce((s, c) => s + c, 0) / vals.length
  return Math.round(avg * 100)
}

/** Mapeia a resposta crua do modelo para o formato MotorNameplate da UI. */
export const mapToNameplate = (resp: OCRResponse): Partial<MotorNameplate> => {
  const c = resp.campos

  const hz = asNumber(c.frequencia_hz) ?? 60
  const rpm = asNumber(c.rpm)
  const voltageList = c.tensao_v?.value
  const voltage = Array.isArray(voltageList)
    ? `${voltageList.join('/')}V`
    : asString(c.tensao_v)

  // Modelo = linha + carcaça + classe de eficiência (ex: "W22 132M IE3")
  const model = [resp.linha, asString(c.carcaca), asString(c.classe_eficiencia)]
    .filter(Boolean)
    .join(' ')

  const ipDigits = asString(c.grau_protecao)
  const isoYear = c.data_fabricacao?.value_iso?.slice(0, 4)

  return {
    manufacturer: resp.fabricante || undefined,
    model: model || undefined,
    serialNumber: asString(c.numero_serie) ?? asString(c.codigo_produto),
    power_kw: asNumber(c.potencia_kw),
    power_cv: asNumber(c.potencia_cv),
    voltage,
    current_a: asNumber(c.corrente_a),
    rpm,
    poles: estimatePoles(rpm, hz),
    frequency_hz: hz,
    ip_class: ipDigits ? `IP${ipDigits}` : undefined,
    insulation_class: asString(c.classe_isolamento),
    yearManufactured: isoYear ? parseInt(isoYear, 10) : undefined,
    ocrConfidence: averageConfidence(c),
  }
}

class OcrAPI {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: OCR_API_URL,
      timeout: 120_000, // OCR + (eventual) VLM pode levar dezenas de segundos
    })
  }

  /** GET /health — verifica se o modelo está carregado. */
  async health(): Promise<{ status: string; model_loaded: string; version: string }> {
    const { data } = await this.client.get('/health')
    return data
  }

  /**
   * POST /ocr/extract — envia a imagem da placa e retorna a resposta crua.
   * @throws OcrNetworkError se o backend estiver inacessível.
   */
  async extract(
    file: File,
    opts: { mode?: OcrMode; preprocess?: boolean } = {},
  ): Promise<OCRResponse> {
    const form = new FormData()
    form.append('image', file)

    try {
      const { data } = await this.client.post<OCRResponse>('/ocr/extract', form, {
        params: {
          mode: opts.mode ?? 'easyocr',
          return_zones: true,
          preprocess: opts.preprocess ?? false,
        },
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    } catch (error) {
      const err = error as AxiosError<{ detail?: string }>
      if (!err.response) {
        throw new OcrNetworkError(
          `Não foi possível conectar ao modelo de OCR em ${OCR_API_URL}. ` +
            'Inicie o backend: uvicorn src.api.main:app (pasta ocr/).',
        )
      }
      const detail =
        err.response.data?.detail || `Falha no OCR (HTTP ${err.response.status})`
      throw new Error(detail)
    }
  }

  /** Extrai e já mapeia para o formato da UI, preservando metadados do pipeline. */
  async extractNameplate(
    file: File,
    opts: { mode?: OcrMode; preprocess?: boolean } = {},
  ): Promise<NameplateExtraction> {
    const resp = await this.extract(file, opts)
    return {
      nameplate: mapToNameplate(resp),
      validation: resp.validacao,
      modelUsed: resp.model_used,
      motorType: resp.tipo_motor,
      processingTimeMs: resp.processing_time_ms,
      rawFields: resp.campos,
    }
  }
}

export const ocrAPI = new OcrAPI()
export { OCR_API_URL }
