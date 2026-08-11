import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Configuração do Supabase ausente. Defina VITE_SUPABASE_URL e ' +
      'VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env (veja .env.example).',
  )
}

/**
 * Client único da aplicação.
 *
 * A sessão é persistida e renovada automaticamente pelo supabase-js — não há
 * refresh manual de token no front.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'forzy.auth',
  },
  global: {
    headers: { 'x-application-name': 'forzy-digital-twin' },
  },
  realtime: {
    params: { eventsPerSecond: 5 },
  },
})

export const REALTIME_ENABLED = import.meta.env.VITE_ENABLE_REAL_TIME_UPDATES !== 'false'

/** Traduz erros do PostgREST/Supabase para mensagens úteis ao operador. */
export function describeSupabaseError(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback

  const err = error as { message?: string; code?: string; details?: string }

  switch (err.code) {
    case 'PGRST301':
    case '42501':
      return 'Você não tem permissão para executar esta ação.'
    case '23505':
      return 'Este registro já existe.'
    case '23503':
      return 'Registro relacionado não encontrado.'
    default:
      break
  }

  if (err.message?.includes('Failed to fetch')) {
    return 'Não foi possível falar com o servidor. Verifique sua conexão.'
  }

  return err.message || fallback
}
