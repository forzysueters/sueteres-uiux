// =============================================================================
// create-user — cria um login de acesso à plataforma (Edge Function, Deno)
//
// O administrador informa e-mail e senha, e a conta já nasce pronta para
// entrar: sem e-mail de convite, sem link para clicar. É o fluxo certo para
// chão de fábrica, onde nem todo técnico tem e-mail corporativo funcionando.
//
// Por que uma Edge Function e não uma chamada direta do navegador: criar conta
// para outra pessoa exige a Auth Admin API, que só responde à SERVICE ROLE KEY.
// Essa chave ignora toda a Row Level Security — se ela chegasse ao front, todo
// mundo que abrisse o DevTools teria acesso irrestrito ao banco.
//
// A function trabalha com duas identidades, de propósito:
//
//   1. Com a JWT de quem chamou, confirma que essa pessoa é administradora
//      ativa. A verificação lê `public.profiles`, a fonte da verdade da
//      autorização — nunca o `app_metadata` do token, que é só a semente do
//      provisionamento e pode estar desatualizada.
//   2. Só depois, com a service role, cria a conta.
//
// A SENHA nunca é registrada em log, nem em caso de erro: as mensagens de falha
// da Auth API são repassadas sem o corpo da requisição junto.
//
// O papel concedido é validado contra uma lista fechada que NÃO inclui `admin`.
// Conceder esse papel é feito fora do produto, e o gatilho
// `guard_profile_privileges` (migração 0017) recusa a promoção mesmo que esta
// function fosse contornada.
//
// Deploy:
//   supabase functions deploy create-user
//
// `SUPABASE_SERVICE_ROLE_KEY` já existe no ambiente das Edge Functions; não
// precisa de `secrets set`.
// =============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

/**
 * Papéis que a aplicação concede. `admin` está fora por regra de negócio —
 * ver o cabeçalho e a migração 0017.
 */
const ASSIGNABLE_ROLES = ['engineer', 'technician'] as const
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

/** Mesmo mínimo que a tela de login exige de quem se cadastra sozinho. */
const MIN_PASSWORD_LENGTH = 8

interface RequestBody {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  role?: string
}

function corsHeadersFor(origin: string | null) {
  const allowOrigin =
    ALLOWED_ORIGINS.includes('*') ? '*' : origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get('Origin'))
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const firstName = (body.firstName ?? '').trim()
  const lastName = (body.lastName ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const role = (body.role ?? '') as AssignableRole

  if (!firstName || !lastName) return json({ error: 'name_required' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid_email' }, 400)
  if (password.length < MIN_PASSWORD_LENGTH) return json({ error: 'weak_password' }, 400)
  if (!ASSIGNABLE_ROLES.includes(role)) return json({ error: 'invalid_role' }, 400)

  // ─── 1. Quem chamou é administrador ativo? ────────────────────────────────
  const asCaller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userError } = await asCaller.auth.getUser()
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)

  const { data: caller } = await asCaller
    .from('profiles')
    .select('role, is_active')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (!caller || caller.role !== 'admin' || !caller.is_active) {
    return json({ error: 'forbidden', message: 'Criar usuários é exclusivo do administrador.' }, 403)
  }

  // ─── 2. A partir daqui, service role ──────────────────────────────────────
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const fullName = `${firstName} ${lastName}`

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    // Sem etapa de confirmação: a conta existe para ser usada agora, e não há
    // link de e-mail nenhum neste fluxo para confirmar coisa alguma.
    email_confirm: true,
    // O papel vai em `app_metadata`, nunca em `user_metadata`: este último é
    // escrito pelo próprio cliente no signup e por isso não concede privilégio
    // (ver migração 0013). É daqui que `handle_new_user` tira o papel, e é o
    // que faz o perfil nascer ATIVO em vez de aguardando liberação.
    app_metadata: { role },
    user_metadata: { full_name: fullName, first_name: firstName, last_name: lastName },
  })

  if (createError || !created?.user) {
    // A mensagem da Auth API entra no log; o corpo da requisição NÃO — ele
    // carrega a senha em texto puro.
    const message = createError?.message ?? 'Falha ao criar o usuário.'
    console.error('[create-user] recusado:', message)
    const alreadyExists = /already|registered|exists/i.test(message)
    return json({ error: alreadyExists ? 'email_taken' : 'create_failed', message }, alreadyExists ? 409 : 502)
  }

  // ─── 3. Confere o que o gatilho provisionou ───────────────────────────────
  // `handle_new_user` já criou o perfil a partir do `app_metadata`. Reafirmar
  // aqui cobre o caso de um provisionamento antigo ter caído no padrão
  // (técnico, inativo) sem ninguém perceber. `auth.uid()` é nulo sob service
  // role, então `guard_profile_privileges` deixa passar.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ role, is_active: true, full_name: fullName })
    .eq('id', created.user.id)

  if (profileError) {
    console.error('[create-user] perfil incompleto:', profileError.message)
    return json(
      {
        error: 'profile_incomplete',
        userId: created.user.id,
        message: 'Conta criada, mas o papel não foi aplicado. Ajuste na lista de usuários.',
      },
      207,
    )
  }

  return json({ userId: created.user.id, email, role })
})
