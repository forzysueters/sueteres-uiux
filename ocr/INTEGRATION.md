# Integração OCR ↔ Frontend

Este documento descreve como o modelo de OCR (WEG W22) foi integrado ao frontend
do gêmeo digital (tela **Equipamentos → Registro de Equipamento**).

## Visão geral

```
┌──────────────┐   POST /ocr/extract (multipart)   ┌────────────────────────┐
│   Frontend   │ ────────────────────────────────► │  Modelo OCR (FastAPI)  │
│  (Vite/React)│                                    │  uvicorn src.api.main  │
│              │ ◄──────────────────────────────── │  EasyOCR + GPT Vision  │
└──────────────┘        OCRResponse (JSON)          └────────────────────────┘
```

- Cliente HTTP: `src/services/ocrAPI.ts` (axios, base `VITE_OCR_API_URL`).
- Mapeamento `campos` do OCR → `MotorNameplate`: `mapToNameplate()` no mesmo arquivo.
- Consumo na UI: `src/components/EquipmentRegistrationForm.tsx` via `apiService.extractNameplate()`.
- Fallback automático para **mock** quando o backend está offline (não quebra a demo).

## 1. Subir o backend de OCR

> Requer **Python 3.10+**.

```bash
cd ocr/OCR-Model-main
py -3.10 -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt

# habilita o modo/fallback GPT Vision:
cp .env.example .env   # e preencha OPENAI_API_KEY

# Windows: force UTF-8 (a barra de progresso do EasyOCR usa caractere unicode
# que quebra no console cp1252). PowerShell:  $env:PYTHONUTF8=1
# CMD:  set PYTHONUTF8=1
uvicorn src.api.main:app --reload --port 8000
```

Verifique: http://localhost:8000/health e http://localhost:8000/docs

> O primeiro start baixa os pesos do EasyOCR (alguns minutos). No Windows,
> defina `PYTHONUTF8=1` antes de subir, senão o download quebra com
> `UnicodeEncodeError` na barra de progresso.

## 2. Configurar o frontend

No `.env` do projeto (raiz), aponte para o backend:

```
VITE_OCR_API_URL=http://localhost:8000
VITE_OCR_USE_MOCK=false
```

`VITE_OCR_USE_MOCK=true` força dados simulados mesmo com o backend no ar (demo offline).

## 3. Usar

1. `npm run dev` e abra **Equipamentos**.
2. O motor é o **GPT Vision** (`mode=gpt`); `mode=easyocr` segue disponível na API.
3. Faça upload da foto da placa (PNG/JPG/WebP até 10 MB).
4. Revise os campos extraídos (confiança, tipo de motor, alertas de validação física).
5. Confirme o registro.

Imagens de teste: `ocr/OCR-Model-main/data/templates/`.

## Mapeamento de campos

| Campo OCR (`campos`)            | `MotorNameplate`        |
| ------------------------------- | ----------------------- |
| `fabricante` (resposta)         | `manufacturer`          |
| `linha` + `carcaca` + `classe_eficiencia` | `model`        |
| `numero_serie` / `codigo_produto` | `serialNumber`        |
| `potencia_kw` / `potencia_cv`   | `power_kw` / `power_cv` |
| `tensao_v` (lista)              | `voltage` (`"220/380V"`)|
| `corrente_a` (1ª)               | `current_a`             |
| `rpm`                           | `rpm`                   |
| `rpm` + `frequencia_hz`         | `poles` (estimado)      |
| `frequencia_hz`                 | `frequency_hz`          |
| `grau_protecao`                 | `ip_class` (`"IP55"`)   |
| `classe_isolamento`             | `insulation_class`      |
| `data_fabricacao.value_iso`     | `yearManufactured`      |
| média das confianças dos campos | `ocrConfidence` (0-100) |

`tag` e `connection` não são extraídos pelo modelo e ficam para preenchimento manual.
