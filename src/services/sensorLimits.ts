import { Sensor } from '../types';

export type SensorStatus = Sensor['status'];

/**
 * Sentido em que a grandeza vira problema. Nem tudo é "alto é ruim": vazão que
 * cai indica cavitação/obstrução, e tensão é ruim nos dois sentidos.
 */
export type LimitDirection = 'above' | 'below' | 'band';

export interface SensorLimit {
  /** Entra em atenção a partir daqui. Em 'band', é o desvio tolerado. */
  warn: number;
  /** Entra em crítico a partir daqui. Em 'band', é o desvio máximo. */
  crit: number;
  direction: LimitDirection;
  /** Centro da faixa — obrigatório para 'band'. */
  nominal?: number;
  /** De onde veio o número. Aparece na justificativa do alerta. */
  source: string;
}

/**
 * Limites genéricos por grandeza. Onde o limite depende da máquina (corrente
 * nominal, rpm de placa, classe de vibração), o ativo declara um override em
 * ASSET_LIMIT_OVERRIDES abaixo.
 */
const SENSOR_LIMITS: Record<string, SensorLimit> = {
  // ISO 10816-3, máquinas classe II (15–75 kW) em base rígida:
  // zona B/C = 4,5 mm/s (aceitável → insatisfatório), C/D = 7,1 (inaceitável).
  'Vibração': { warn: 4.5, crit: 7.1, direction: 'above', source: 'ISO 10816-3 — zona B/C e C/D' },
  // Mesma grandeza com o nome que os pontos de medição reais usam (LAB-S1/S2) e
  // que os motores passaram a usar. Os dois nomes coexistem de propósito: bomba,
  // compressor e exaustor continuam com 'Vibração'.
  'Velocidade de Vibração': { warn: 4.5, crit: 7.1, direction: 'above', source: 'ISO 10816-3 — zona B/C e C/D' },

  // Fallback provisório, herdado do cadastro dos pontos reais. O limite honesto
  // depende da rotação da máquina (a = 2πf·v), então cada motor declara o seu
  // override abaixo — este valor só vale enquanto não houver dado real medido.
  'Aceleração': { warn: 10, crit: 20, direction: 'above', source: 'Provisório — recalibrar com dado real' },

  // Isolamento classe F (155 °C) com margem de projeto: atenção bem antes do
  // limite do verniz, porque o dano é cumulativo.
  'Temperatura': { warn: 75, crit: 90, direction: 'above', source: 'Isolamento classe F' },
  'Temp. Mancal': { warn: 70, crit: 85, direction: 'above', source: 'Graxa de rolamento, vida útil cai pela metade a cada +15 °C' },

  'Tensão': { warn: 19, crit: 38, direction: 'band', nominal: 380, source: 'NBR 5410 — ±5% e ±10% de 380 V' },
};

/**
 * Limites que só fazem sentido para um ativo específico. A chave é a TAG
 * industrial do ativo; o valor sobrescreve (ou complementa) SENSOR_LIMITS.
 *
 * Estes números são a linha de base de engenharia e servem de fallback: em
 * runtime, `registerSensorLimits` sobrescreve com os limites vindos do banco,
 * que é onde eles passaram a ser mantidos (ver supabase/seed.sql).
 */
const ASSET_LIMIT_OVERRIDES: Record<string, Record<string, SensorLimit>> = {
  // Os dois motores medem as mesmas três grandezas dos pontos reais do Forzy Lab
  // (velocidade de vibração, aceleração, temperatura). A aceleração não tem
  // limite universal: para um harmônico, a = 2πf·v, então o mesmo corte da ISO
  // 10816-3 vale um número diferente em cada rotação. Derivar daí mantém os dois
  // sensores do mesmo motor contando a mesma história.
  'MTR-001': {
    // 1760 rpm → 29,33 Hz → 2πf = 184,3 s⁻¹. 4,5 mm/s ⇒ 0,83 m/s²; 7,1 ⇒ 1,31.
    'Aceleração': { warn: 0.83, crit: 1.31, direction: 'above', source: 'ISO 10816-3 convertida a 1760 rpm (a = 2πf·v)' },
  },
  'MTR-002': {
    // 1465 rpm → 24,42 Hz → 2πf = 153,4 s⁻¹. 4,5 mm/s ⇒ 0,69 m/s²; 7,1 ⇒ 1,09.
    'Aceleração': { warn: 0.69, crit: 1.09, direction: 'above', source: 'ISO 10816-3 convertida a 1465 rpm (a = 2πf·v)' },
  },
  'BBA-001': {
    'Pressão': { warn: 3.5, crit: 4.2, direction: 'above', source: 'Pressão de recalque do circuito de refrigeração' },
    // Vazão que cai indica cavitação, obstrução ou desgaste de rotor.
    'Vazão': { warn: 120, crit: 100, direction: 'below', source: 'Vazão mínima de projeto do circuito (145 L/min nominal)' },
    // Água de refrigeração, não enrolamento: limite bem menor que o do motor.
    'Temperatura': { warn: 60, crit: 75, direction: 'above', source: 'Fluido de refrigeração — perda de eficiência térmica' },
    'Potência': { warn: 5.5, crit: 6.3, direction: 'above', source: 'P = 5,5 kW de placa, fator de serviço 1,15' },
  },
  'CMP-001': {
    'Pressão de Saída': { warn: 8.5, crit: 9.5, direction: 'above', source: 'Pressão de trabalho 7 bar, alívio da válvula em 9,5' },
    'Temp. Entrada': { warn: 40, crit: 50, direction: 'above', source: 'Ar de admissão — acima disso a eficiência volumétrica cai' },
    'Temp. Saída': { warn: 95, crit: 110, direction: 'above', source: 'Descarga — degradação do óleo do estágio' },
    'Corrente Motor': { warn: 42.0, crit: 48.3, direction: 'above', source: 'In = 42,0 A de placa, fator de serviço 1,15' },
  },
  'EXA-001': {
    // 0,75 kW → ISO 10816-3 classe I (máquinas pequenas): limites mais apertados.
    'Vibração': { warn: 2.8, crit: 4.5, direction: 'above', source: 'ISO 10816-3 — classe I, zona B/C e C/D' },
    'Velocidade': { warn: 60, crit: 40, direction: 'below', source: 'Rotação mínima para a renovação de ar do galpão' },
    'Corrente Motor': { warn: 3.2, crit: 3.68, direction: 'above', source: 'In = 3,2 A de placa, fator de serviço 1,15' },
  },
};

/**
 * Limites carregados do banco em runtime (tabela `sensors`), por TAG do ativo.
 *
 * O banco é a fonte da verdade: é lá que a ingestão classifica a leitura e
 * dispara o alerta. Registrar aqui mantém a decisão do front — status, cor do
 * gauge e glow do 3D — em cima dos mesmos números, sem duplicar constante.
 */
const RUNTIME_LIMITS: Record<string, Record<string, SensorLimit>> = {};

export interface SensorLimitInput {
  warn: number | null | undefined;
  crit: number | null | undefined;
  direction?: string | null;
  nominal?: number | null;
  source?: string | null;
}

/** Registra (ou atualiza) o limite de uma grandeza a partir do banco. */
export function registerSensorLimits(
  assetTag: string,
  sensorName: string,
  input: SensorLimitInput,
): void {
  if (input.warn == null || input.crit == null) return;

  const direction = (input.direction ?? 'above') as LimitDirection;
  if (direction === 'band' && input.nominal == null) return;

  RUNTIME_LIMITS[assetTag] ??= {};
  RUNTIME_LIMITS[assetTag][sensorName] = {
    warn: input.warn,
    crit: input.crit,
    direction,
    nominal: input.nominal ?? undefined,
    source: input.source ?? 'Limite configurado no cadastro do sensor',
  };
}

/** Esquece os limites carregados. Existe para isolar os testes. */
export function clearRegisteredLimits(): void {
  for (const key of Object.keys(RUNTIME_LIMITS)) delete RUNTIME_LIMITS[key];
}

/**
 * Limite aplicável a uma grandeza, considerando o ativo. Null se não houver.
 * Precedência: banco → override estático por TAG → limite genérico da grandeza.
 */
export function limitFor(sensorName: string, assetTag?: string): SensorLimit | null {
  const fromDb = assetTag ? RUNTIME_LIMITS[assetTag]?.[sensorName] : undefined;
  const override = assetTag ? ASSET_LIMIT_OVERRIDES[assetTag]?.[sensorName] : undefined;
  return fromDb ?? override ?? SENSOR_LIMITS[sensorName] ?? null;
}

/** Distância até o limite, na métrica da direção (sempre "quanto maior, pior"). */
const severityMetric = (limit: SensorLimit, value: number): number => {
  switch (limit.direction) {
    case 'above': return value;
    case 'below': return -value;
    case 'band': return Math.abs(value - (limit.nominal ?? 0));
  }
};

const thresholds = (limit: SensorLimit): { warn: number; crit: number } =>
  limit.direction === 'below'
    ? { warn: -limit.warn, crit: -limit.crit }
    : { warn: limit.warn, crit: limit.crit };

/**
 * Status de um sensor a partir do seu valor. Único lugar da aplicação que
 * decide se um número está bom — status de ativo, alertas e o glow do 3D
 * derivam todos daqui.
 */
export function statusFor(sensorName: string, value: number, assetTag?: string): SensorStatus {
  const limit = limitFor(sensorName, assetTag);
  if (!limit) return 'normal';
  const m = severityMetric(limit, value);
  const t = thresholds(limit);
  if (m >= t.crit) return 'critical';
  if (m >= t.warn) return 'warning';
  return 'normal';
}

/** Número no formato pt-BR, preservando as casas decimais que o valor tem. */
const fmt = (n: number) => String(n).replace('.', ',');

/**
 * Justificativa legível de por que o sensor está fora de faixa, construída a
 * partir do próprio valor medido — é isto que garante que o texto do alerta
 * nunca contradiga o número exibido no gauge. Null quando o sensor está normal.
 */
export function reasonFor(
  sensorName: string, value: number, unit: string, assetTag?: string,
): string | null {
  const limit = limitFor(sensorName, assetTag);
  if (!limit) return null;
  const status = statusFor(sensorName, value, assetTag);
  if (status === 'normal') return null;

  const breached = status === 'critical' ? limit.crit : limit.warn;
  const v = `${fmt(value)} ${unit}`;

  if (limit.direction === 'band') {
    const nominal = limit.nominal ?? 0;
    const desvio = Math.abs(value - nominal);
    return `${v} desviou ${fmt(parseFloat(desvio.toFixed(2)))} ${unit} do nominal de ${fmt(nominal)} ${unit} `
      + `(tolerância ±${fmt(breached)} ${unit} — ${limit.source})`;
  }

  const relacao = limit.direction === 'above' ? 'acima do limite de' : 'abaixo do mínimo de';
  return `${v} ${relacao} ${fmt(breached)} ${unit} (${limit.source})`;
}

/**
 * Faixa de exibição do gauge. Precisa englobar o limite de atenção, senão o
 * marcador de threshold satura na ponta da barra e a leitura fica sem contexto.
 */
export function gaugeRange(
  sensorName: string, base: number, assetTag?: string,
): { min: number; max: number } {
  const limit = limitFor(sensorName, assetTag);
  let min = base * 0.7;
  let max = base * 1.3;
  if (limit) {
    if (limit.direction === 'above') max = Math.max(max, limit.warn * 1.08);
    if (limit.direction === 'below') min = Math.min(min, limit.crit * 0.92);
    if (limit.direction === 'band') {
      const nominal = limit.nominal ?? base;
      min = Math.min(min, nominal - limit.crit * 1.08);
      max = Math.max(max, nominal + limit.crit * 1.08);
    }
  }
  return { min: parseFloat(min.toFixed(2)), max: parseFloat(max.toFixed(2)) };
}

// ─── Papel do sensor ────────────────────────────────────────────────────────
// Cada ativo batiza suas grandezas de um jeito ("Temperatura", "Temp. Saída",
// "Temp. Mancal"), então quem precisa de "a temperatura deste ativo" — o viewer
// 3D e o modelo de anomalia — resolve por papel em vez de casar string literal.
export type SensorRole = 'temperature' | 'vibration';

/** Nomes aceitos por papel, em ordem de preferência (o mais diagnóstico primeiro). */
// Cuidado ao mexer aqui: EXA-001 tem um sensor chamado 'Velocidade' que é
// rotação em %, grandeza diferente. O alias precisa ser o nome completo
// 'Velocidade de Vibração', nunca 'Velocidade' sozinho.
const ROLE_ALIASES: Record<SensorRole, string[]> = {
  temperature: ['Temperatura', 'Temp. Saída', 'Temp. Mancal', 'Temp. Entrada'],
  vibration: ['Vibração', 'Velocidade de Vibração'],
};

export function sensorByRole(sensors: Sensor[], role: SensorRole): Sensor | undefined {
  for (const alias of ROLE_ALIASES[role]) {
    const hit = sensors.find((s) => s.name === alias);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Posição do sensor entre "folgado" e "no limite crítico", em 0-1.
 *
 * Serve para traduzir grandezas de unidades diferentes (mm/s, °C, A) numa
 * escala comum de severidade — é o que permite alimentar o modelo de anomalia
 * com os sensores reais sem sair da faixa numérica em que ele foi treinado.
 *
 * A escala é partida ao meio de propósito: 0-0,5 percorre a faixa normal e
 * 0,5-1 percorre o trecho entre atenção e crítico. Assim um sensor saudável
 * fica em torno de 0,2-0,4 e não infla o score.
 */
export function deviationOf(sensor: Sensor, assetTag?: string): number {
  const limit = limitFor(sensor.name, assetTag);
  if (!limit) return 0;
  const m = severityMetric(limit, sensor.value);
  const t = thresholds(limit);
  const floor = severityMetric(limit, limit.direction === 'band' ? (limit.nominal ?? 0) : sensor.min);
  if (m <= t.warn) {
    const span = t.warn - floor;
    return span <= 0 ? 0 : 0.5 * clamp01((m - floor) / span);
  }
  return 0.5 + 0.5 * clamp01((m - t.warn) / (t.crit - t.warn));
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Valor de atenção, usado como `threshold` do gauge (marcador âmbar na barra). */
export function warnThreshold(sensorName: string, base: number, assetTag?: string): number {
  const limit = limitFor(sensorName, assetTag);
  if (!limit) return parseFloat((base * 1.2).toFixed(2));
  if (limit.direction === 'band') return parseFloat(((limit.nominal ?? base) + limit.warn).toFixed(2));
  return limit.warn;
}
