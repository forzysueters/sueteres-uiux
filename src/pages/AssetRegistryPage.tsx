/**
 * Sprint 1 — Tela de Cadastro Técnico do Ativo.
 *
 * Mostra TODOS os campos técnicos do MTR-001 (motor de referência WEG W22),
 * organizados por categoria, e abaixo lista os campos da placa que serão
 * extraídos por OCR nas próximas sprints.
 *
 * O formulário de novo cadastro é exibido em modal — campos pré-preenchidos
 * a partir do mesmo schema, podendo ser editados manualmente.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Camera,
  ClipboardList,
  Cog,
  FileText,
  Settings2,
  Sparkles,
  Thermometer,
  Wrench,
  Zap,
} from 'lucide-react'
import { digitalTwinAPI } from '../services/digitalTwinAPI'
import { Equipment, PlacaField } from '../types/digital-twin'
import { cn } from '../lib/utils'

const TAG = 'MTR-001'

export const AssetRegistryPage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['equipment', TAG],
    queryFn: () => digitalTwinAPI.getEquipment(TAG),
  })

  const { data: placaFields } = useQuery({
    queryKey: ['placa-fields'],
    queryFn: () => digitalTwinAPI.getPlacaFields(),
  })

  const [activeTab, setActiveTab] = useState<'cadastro' | 'placa'>('cadastro')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted">
        Carregando cadastro técnico…
      </div>
    )
  }

  const eq = data?.equipment

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end md:justify-between gap-4"
      >
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card-hover text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">
            <Sparkles size={11} className="text-primary" />
            <span>Sprint 1 · Cadastro Técnico</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Cadastro Técnico do Ativo
          </h1>
          <p className="mt-1.5 text-xs md:text-sm">
            Campos derivados do datasheet do fabricante. Estrutura base do
            Digital Twin.
          </p>
        </div>
      </motion.div>

      <div className="flex items-center gap-2 border-b border-border overflow-x-auto scrollbar-thin -mx-4 px-4 md:mx-0 md:px-0">
        <TabButton
          active={activeTab === 'cadastro'}
          onClick={() => setActiveTab('cadastro')}
          icon={ClipboardList}
        >
          <span className="hidden sm:inline">Cadastro do Equipamento</span>
          <span className="sm:hidden">Cadastro</span>
        </TabButton>
        <TabButton
          active={activeTab === 'placa'}
          onClick={() => setActiveTab('placa')}
          icon={Camera}
        >
          <span className="hidden sm:inline">Campos da Placa (OCR Sprint 2/3)</span>
          <span className="sm:hidden">Placa (OCR)</span>
        </TabButton>
      </div>

      {activeTab === 'cadastro' && eq && <CadastroPanel eq={eq} />}
      {activeTab === 'placa' && (
        <PlacaFieldsPanel fields={placaFields ?? []} />
      )}
    </div>
  )
}

const TabButton: React.FC<{
  active: boolean
  onClick: () => void
  icon: typeof ClipboardList
  children: React.ReactNode
}> = ({ active, onClick, icon: Icon, children }) => (
  <button
    onClick={onClick}
    className={cn(
      'relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
      active
        ? 'text-foreground'
        : 'text-muted hover:text-foreground-soft',
    )}
  >
    <Icon size={15} className={active ? 'text-primary' : 'text-muted'} />
    {children}
    {active && (
      <motion.div
        layoutId="registry-tab"
        className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full"
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      />
    )}
  </button>
)

const CadastroPanel: React.FC<{ eq: Equipment }> = ({ eq }) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <Section title="Identificação" icon={FileText}>
        <Field label="TAG" value={eq.tag} mono />
        <Field label="Nome" value={eq.name} />
        <Field label="Localização" value={eq.location} />
        <Field label="Fabricante" value={eq.fabricante} />
        <Field label="Código fabricante" value={eq.codigo_fabricante} mono />
        <Field label="Modelo" value={eq.modelo} />
        <Field label="Linha" value={eq.linha} />
        <Field label="Categoria" value={eq.categoria} />
        <Field label="Norma" value={eq.norma} />
      </Section>

      <Section title="Elétricos" icon={Zap}>
        <Field label="Tensão nominal" value={eq.tensao_nominal} />
        <Field label="Corrente nominal" value={eq.corrente_nominal} />
        <Field label="Corrente de partida" value={eq.corrente_partida} />
        <Field label="Corrente a vazio" value={eq.corrente_vazio} />
        <Field label="Frequência" value={fmt(eq.frequencia_hz, 'Hz')} />
        <Field label="Polos" value={eq.numero_polos} />
        <Field label="Ip / In" value={eq.ip_in} />
        <Field
          label="Conjugado nominal"
          value={fmt(eq.conjugado_nominal_kgfm, 'kgf·m')}
        />
        <Field
          label="Conjugado partida"
          value={fmt(eq.conjugado_partida_pct, '%')}
        />
        <Field
          label="Conjugado máximo"
          value={fmt(eq.conjugado_maximo_pct, '%')}
        />
        <Field
          label="Tempo rotor bloq. (frio)"
          value={fmt(eq.tempo_rotor_bloq_frio_s, 's')}
        />
        <Field
          label="Tempo rotor bloq. (quente)"
          value={fmt(eq.tempo_rotor_bloq_quente_s, 's')}
        />
        <Field label="Método de partida" value={eq.metodo_partida} />
      </Section>

      <Section title="Mecânicos" icon={Cog}>
        <Field label="Carcaça" value={eq.carcaca} />
        <Field label="Potência" value={fmt(eq.potencia_cv, 'cv')} />
        <Field label="Potência" value={fmt(eq.potencia_kw, 'kW')} />
        <Field
          label="Rotação síncrona"
          value={fmt(eq.rotacao_sincrona_rpm, 'rpm')}
        />
        <Field
          label="Rotação nominal"
          value={fmt(eq.rotacao_nominal_rpm, 'rpm')}
        />
        <Field label="Escorregamento" value={fmt(eq.escorregamento_pct, '%')} />
        <Field label="Forma construtiva" value={eq.forma_construtiva} />
        <Field label="Fixação" value={eq.fixacao} />
        <Field label="Flange" value={eq.flange} />
        <Field label="Caixa de ligação" value={eq.caixa_ligacao_posicao} />
        <Field label="Refrigeração" value={eq.refrigeracao} />
        <Field label="Sentido de rotação" value={eq.sentido_rotacao} />
        <Field label="Massa" value={fmt(eq.massa_kg, 'kg')} />
        <Field label="Ruído" value={fmt(eq.nivel_ruido_dba, 'dB(A)')} />
      </Section>

      <Section title="Térmicos / Ambientais" icon={Thermometer}>
        <Field label="Grau de proteção" value={eq.grau_protecao} />
        <Field label="Classe de isolamento" value={eq.classe_isolamento} />
        <Field
          label="Elevação de temp."
          value={fmt(eq.elevacao_temperatura_k, 'K')}
        />
        <Field label="Regime de serviço" value={eq.regime_servico} />
        <Field
          label="Temp. ambiente"
          value={
            eq.temperatura_ambiente_min_c !== null &&
            eq.temperatura_ambiente_max_c !== null
              ? `${eq.temperatura_ambiente_min_c} a ${eq.temperatura_ambiente_max_c} °C`
              : null
          }
        />
        <Field label="Altitude máx." value={fmt(eq.altitude_max_m, 'm')} />
      </Section>

      <Section title="Mancal / Rolamento" icon={Settings2}>
        <Field label="Dianteiro (DE)" value={eq.mancal_dianteiro_tipo} />
        <Field label="Traseiro (NDE)" value={eq.mancal_traseiro_tipo} />
        <Field label="Vedação dianteira" value={eq.vedacao_dianteiro} />
        <Field label="Vedação traseira" value={eq.vedacao_traseiro} />
        <Field label="Carga axial" value={fmt(eq.carga_axial_kgf, 'kgf')} />
      </Section>

      <Section title="Construtivos / Manutenção" icon={Wrench}>
        <Field label="Material da carcaça" value={eq.material_carcaca} />
        <Field label="Material do eixo" value={eq.material_eixo} />
        <Field label="Material do ventilador" value={eq.material_ventilador} />
        <Field label="Pintura" value={eq.pintura} />
        <Field label="Aterramento" value={eq.tipo_aterramento} />
        <Field label="Capacitor" value={eq.capacitor} />
        <Field label="Sistema de partida" value={eq.sistema_partida} />
        <Field label="Vedação" value={eq.vedacao} />
        <Field label="Última manutenção" value={eq.ultima_manutencao} />
        <Field label="Próxima manutenção" value={eq.proxima_manutencao} />
      </Section>
    </div>
  )
}

const PlacaFieldsPanel: React.FC<{ fields: PlacaField[] }> = ({ fields }) => {
  const groups: Record<PlacaField['category'], PlacaField[]> = {
    identificacao: [],
    eletrico: [],
    mecanico: [],
    termico: [],
  }
  for (const f of fields) groups[f.category].push(f)

  const meta: Record<PlacaField['category'], { title: string; icon: any }> = {
    identificacao: { title: 'Identificação', icon: FileText },
    eletrico: { title: 'Elétricos', icon: Zap },
    mecanico: { title: 'Mecânicos', icon: Cog },
    termico: { title: 'Térmicos / Proteção', icon: Thermometer },
  }

  return (
    <div className="space-y-6">
      <div className="saas-card-premium p-5">
        <div className="flex items-start gap-3">
          <Camera size={20} className="text-primary mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Definição dos campos da placa para OCR
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Lista taxonômica dos campos visíveis em placas de motor que serão
              extraídos automaticamente nas Sprints 2/3 via Visão Computacional
              + LLM multimodal. Cada campo traz exemplo do W22, padrão de
              extração (regex), prioridade de OCR e categoria.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {(Object.keys(groups) as PlacaField['category'][]).map((cat) => {
          const m = meta[cat]
          const list = groups[cat]
          if (!list.length) return null
          return (
            <Section key={cat} title={m.title} icon={m.icon}>
              <div className="-m-2 grid grid-cols-1 gap-2">
                {list.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-lg bg-card-hover border border-border"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {f.display_name}
                        </span>
                        {f.unit && (
                          <span className="text-[10px] font-mono text-muted-soft">
                            ({f.unit})
                          </span>
                        )}
                      </div>
                      <PriorityBadge priority={f.ocr_priority} required={!!f.required} />
                    </div>
                    {f.example && (
                      <p className="text-[11px] text-muted-soft mb-1">
                        <span className="text-muted">exemplo: </span>
                        <span className="font-mono">{f.example}</span>
                      </p>
                    )}
                    {f.regex_hint && (
                      <p className="text-[10px] text-muted-soft font-mono">
                        regex: {f.regex_hint}
                      </p>
                    )}
                    {f.notes && (
                      <p className="text-[11px] text-muted mt-1 italic">
                        {f.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )
        })}
      </div>
    </div>
  )
}

const PriorityBadge: React.FC<{ priority: number; required: boolean }> = ({
  priority,
  required,
}) => (
  <div className="flex items-center gap-1">
    {required && (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-500/10 text-red-500 border border-red-500/20">
        Obrigatório
      </span>
    )}
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border',
        priority === 1 &&
          'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        priority === 2 && 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        priority === 3 && 'bg-slate-500/10 text-slate-500 border-slate-500/20',
      )}
    >
      P{priority}
    </span>
  </div>
)

const Section: React.FC<{
  title: string
  icon: typeof ClipboardList
  children: React.ReactNode
}> = ({ title, icon: Icon, children }) => (
  <div className="saas-card-premium p-5">
    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
      <Icon size={15} className="text-primary" />
      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
        {title}
      </h3>
    </div>
    <div className="space-y-2.5">{children}</div>
  </div>
)

const Field: React.FC<{
  label: string
  value: string | number | null | undefined
  mono?: boolean
}> = ({ label, value, mono }) => (
  <div className="flex items-baseline justify-between gap-3 text-xs">
    <span className="text-muted">{label}</span>
    <span
      className={cn(
        'text-foreground-soft font-medium tabular-nums text-right truncate max-w-[60%]',
        mono && 'font-mono',
      )}
    >
      {value === null || value === undefined || value === '' ? (
        <span className="text-muted-soft italic">—</span>
      ) : (
        value
      )}
    </span>
  </div>
)

function fmt(value: number | null | undefined, unit: string): string | null {
  if (value === null || value === undefined) return null
  return `${value} ${unit}`
}
