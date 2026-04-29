import express, { Express, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import equipmentRoutes from './routes/equipment.js'
import { authenticateToken } from './middleware/auth.js'
import './db/connection.js'
import { seedDatabase } from './db/seed.js'
import { IoTMockGenerator } from './services/iot-mock.service.js'

dotenv.config()

const app: Express = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(
  cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowedOrigins = (
        process.env.CORS_ORIGIN || 'http://localhost:5173'
      ).split(',')
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  }),
)

// ── Public routes ──
app.use('/auth', authRoutes)

// ── Protected route example ──
app.get('/api/profile', authenticateToken, (req: Request, res: Response) => {
  res.json({
    message: 'Protected route accessed',
    user: (req as any).user,
  })
})

// ── Sprint 1 — Cadastro técnico + telemetria ──
// Em desenvolvimento as rotas ficam abertas para facilitar a demo.
// Para protegê-las, troque para:
//   app.use('/api/equipments', authenticateToken, equipmentRoutes)
app.use('/api/equipments', equipmentRoutes)

// ── Health check ──
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' })
})

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
  })
})

// ── Bootstrap: seed + start IoT mock generator ──
seedDatabase()

const enableMock = process.env.IOT_MOCK !== 'off'
if (enableMock) {
  const generator = new IoTMockGenerator('MTR-001')
  generator.warmupHistory(360, 10) // 1h de histórico simulado, ponto a cada 10s
  generator.start(2000) // tick em tempo real a cada 2s

  process.on('SIGTERM', () => generator.stop())
  process.on('SIGINT', () => generator.stop())
}

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`)
  console.log(
    `🔐 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`,
  )
  console.log(
    `🛰️  IoT mock generator: ${enableMock ? 'ON' : 'OFF (IOT_MOCK=off)'}`,
  )
})
