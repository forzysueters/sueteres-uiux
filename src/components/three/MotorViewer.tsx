import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import { useAppStore } from '../../store/appStore';
import { MotorModel, MotorPrimitive, TelemetryData } from './MotorModel';
import { MachineGeometry } from './MachineGeometry';
import { ModelErrorBoundary } from './ModelErrorBoundary';
import { sensorByRole, statusFor, limitFor } from '../../services/sensorLimits';
import { statusConfig, statusUrgency } from '../../utils/plantStatus';
import type { Asset } from '../../types';

interface MotorViewerProps {
  assetId: string;
}

/**
 * Lê a telemetria atual do ativo direto do store (sem hook/re-render).
 *
 * Resolve por PAPEL, não por nome literal: o compressor chama sua temperatura
 * de "Temp. Saída" e o exaustor de "Temp. Mancal", então a busca por
 * `name === 'Temperatura'` caía no default de 25 °C e o 3D nunca esquentava.
 */
function readTelemetry(assetId: string): TelemetryData {
  const asset = useAppStore.getState().assets.find((a) => a.id === assetId);
  const sensors = asset?.sensors ?? [];
  return {
    temperatura: sensorByRole(sensors, 'temperature')?.value ?? 25,
    vibracao: sensorByRole(sensors, 'vibration')?.value ?? 0,
  };
}

// ─── Enquadramento e âncoras por tipo de máquina ─────────────────────────────
//
// Cada tipo de ativo tem seu próprio volume: o motor usa o GLB da WEG, e bomba,
// compressor e exaustor usam os proceduriais de MachineGeometry — os mesmos que
// a planta 3D desenha. Antes esta tela mostrava o motor para todo mundo, então
// uma bomba aparecia como um motor azul.
//
// `scale`/`yOffset` enquadram o volume: as máquinas proceduriais são construídas
// em escala de planta (apoiadas em y=0, para leitura de silhueta a ~15 unidades)
// e aqui a câmera está a ~7. O offset sobe cada uma até a meia-altura cair na
// origem, que é para onde a câmera olha. O motor já se enquadra sozinho —
// MotorModel aplica Center scale={6} internamente —, por isso 1 e 0.
//
// As âncoras ficam em coordenadas LOCAIS da máquina (o mesmo espaço em que
// MachineGeometry posiciona as peças), porque as labels são renderizadas dentro
// do mesmo grupo: assim elas acompanham escala e offset sem recálculo.
// Para o motor isso é a identidade, então continuam sendo as world-space de
// antes — a de TEMP sobre o mancal do lado acionado, o mesmo ponto de onde o
// gradiente térmico nasce no shader (HOTSPOT_END em MotorModel.tsx); se você
// inverter lá, inverta o sinal de X aqui.
interface ViewerSetup {
  scale: number;
  yOffset: number;
  tempAnchor: [number, number, number];
  vibAnchor: [number, number, number];
  /** Legendas no vocabulário da máquina: um exaustor não tem "mancal DE". */
  tempCaption: string;
  vibCaption: string;
}

const VIEWER_SETUP: Record<Asset['type'], ViewerSetup> = {
  motor: {
    scale: 1,
    yOffset: 0,
    tempAnchor: [1.4, 0.5, 0.8],
    vibAnchor: [-1.4, 0.5, -0.8],
    tempCaption: 'Temp · Mancal DE',
    vibCaption: 'Vibração · Traseira',
  },
  // Bomba: ~2,4 un de largura, topo do recalque em ~1,45 (meia-altura 0,73).
  pump: {
    scale: 1.35,
    yOffset: -0.99,
    tempAnchor: [0.62, 1.15, 0],
    vibAnchor: [-0.6, 1.6, 0],
    // BBA-001 mede o fluido de refrigeração, não enrolamento (ver seed.sql).
    tempCaption: 'Temp · Fluido',
    vibCaption: 'Vibração · Voluta',
  },
  // Compressor: ~3,0 un de largura, topo dos cilindros em ~2,03 (meia 1,02).
  compressor: {
    scale: 1.1,
    yOffset: -1.12,
    tempAnchor: [0.5, 2.35, 0],
    vibAnchor: [-1.15, 1.45, 0],
    // CMP-001 chama sua temperatura de "Temp. Saída" — é a descarga do estágio.
    tempCaption: 'Temp · Descarga',
    vibCaption: 'Vibração · Conjunto Rotativo',
  },
  // Exaustor: mais alto que largo — topo da carcaça em ~2,13 (meia 1,07).
  fan: {
    scale: 1.5,
    yOffset: -1.61,
    tempAnchor: [0.85, 0.75, 0],
    vibAnchor: [0, 2.45, 0],
    tempCaption: 'Temp · Mancal',
    vibCaption: 'Vibração · Carcaça',
  },
};

/** Card de label industrial (dark, borda limpa) ancorado numa peça do motor. */
function InstrumentLabel({
  caption,
  value,
  unit,
  alert = false,
}: {
  caption: string;
  value: string;
  unit: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`pointer-events-none w-max select-none rounded-lg border px-2.5 py-1.5 backdrop-blur-md ${
        alert ? 'border-red-500/50 bg-red-500/15' : 'border-border bg-white/80 dark:bg-slate-950/70'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            alert ? 'animate-pulse bg-red-500' : 'bg-primary'
          }`}
        />
        <span className="text-[8px] font-bold uppercase tracking-wider text-muted">{caption}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span
          className={`text-base font-bold tabular-nums leading-none ${
            alert ? 'text-red-500' : 'text-foreground'
          }`}
        >
          {value}
        </span>
        <span className="text-[9px] font-semibold text-muted">{unit}</span>
      </div>
    </div>
  );
}

/** Labels HTML ancoradas — re-renderizam a 0,5Hz (tick do store), não a cena. */
function LiveLabels({ assetId, setup }: MotorViewerProps & { setup: ViewerSetup }) {
  // Os limites são indexados pela TAG industrial do ativo, não pelo id.
  const assetTag = useAppStore((s) => s.assets.find((a) => a.id === assetId)?.tag);
  const tempSensor = useAppStore(
    (s) => sensorByRole(s.assets.find((a) => a.id === assetId)?.sensors ?? [], 'temperature'),
  );
  const vibSensor = useAppStore(
    (s) => sensorByRole(s.assets.find((a) => a.id === assetId)?.sensors ?? [], 'vibration'),
  );
  const temp = tempSensor?.value;
  const vib = vibSensor?.value;

  // Mesmo critério do gauge e do alerta: a label acende quando o sensor sai da
  // faixa, não num limiar próprio (antes era `> 80`, enquanto o glow começava
  // em 70 e o alerta falava em 75 — três números para o mesmo fenômeno).
  const tempAlert = tempSensor != null && statusFor(tempSensor.name, tempSensor.value, assetTag) !== 'normal';
  const vibAlert = vibSensor != null && statusFor(vibSensor.name, vibSensor.value, assetTag) !== 'normal';

  // Nem todo ativo mede as duas grandezas: BBA-001, por exemplo, não tem sensor
  // de vibração (mede pressão, vazão, temperatura e potência). Uma label
  // ancorada num sensor inexistente só exibia um travessão flutuando sobre o
  // modelo — melhor não desenhá-la.
  return (
    <>
      {/* `zIndexRange` é obrigatório aqui: o padrão do drei é 16777271, que
          passa por cima de qualquer modal (o Dialog usa z-50). Mesma faixa do
          AssetMarker, para as duas camadas 3D empilharem de forma coerente. */}
      {temp != null && (
        <Html position={setup.tempAnchor} center occlude zIndexRange={[20, 0]}>
          <InstrumentLabel
            caption={setup.tempCaption}
            value={temp.toFixed(1)}
            unit="°C"
            alert={tempAlert}
          />
        </Html>
      )}
      {vib != null && (
        <Html position={setup.vibAnchor} center occlude zIndexRange={[20, 0]}>
          <InstrumentLabel
            caption={setup.vibCaption}
            value={vib.toFixed(1)}
            unit="mm/s"
            alert={vibAlert}
          />
        </Html>
      )}
    </>
  );
}

/**
 * Volume das máquinas proceduriais (bomba, compressor, exaustor).
 *
 * Elas não recebem telemetria: comunicam estado por cor, e quem traduz status em
 * cor é `plantStatus` — a mesma fonte que a planta 3D e o mapa SVG consomem.
 * Dois lugares decidindo "que cor é warning" é exatamente como eles saem de
 * sincronia. Assina o store por conta própria, como LiveLabels, para não forçar
 * re-render do componente que hospeda o Canvas.
 */
function MachineVolume({ assetId, type }: MotorViewerProps & { type: Asset['type'] }) {
  const status = useAppStore((s) => s.assets.find((a) => a.id === assetId)?.status) ?? 'normal';
  return (
    <MachineGeometry
      type={type}
      accent={statusConfig(status).fill}
      urgency={statusUrgency(status)}
      running={status !== 'offline'}
    />
  );
}

export default function MotorViewer({ assetId }: MotorViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const telemetryRef = useRef<TelemetryData>(readTelemetry(assetId));
  const [inView, setInView] = useState(true);
  const [visible, setVisible] = useState(!document.hidden);
  const [dpr, setDpr] = useState(1.5);

  // O tipo do ativo escolhe o volume e o enquadramento. Não muda em runtime,
  // mas vem do store porque o ativo pode ainda não ter carregado no 1º render.
  const assetType = useAppStore((s) => s.assets.find((a) => a.id === assetId)?.type) ?? 'motor';
  const setup = VIEWER_SETUP[assetType] ?? VIEWER_SETUP.motor;

  // Limites da temperatura DESTE ativo: o glow acende no `warn` e satura no
  // `crit`, os mesmos cortes que pintam o gauge e disparam o alerta.
  const tempLimits = useMemo(() => {
    const asset = useAppStore.getState().assets.find((a) => a.id === assetId);
    const sensor = sensorByRole(asset?.sensors ?? [], 'temperature');
    const limit = sensor ? limitFor(sensor.name, asset?.tag) : null;
    return limit ? { warn: limit.warn, crit: limit.crit } : undefined;
  }, [assetId]);

  // Assinatura transiente: mantém o ref atualizado a cada tick, SEM re-render.
  useEffect(() => {
    const sync = () => {
      telemetryRef.current = readTelemetry(assetId);
    };
    sync();
    const unsub = useAppStore.subscribe(sync);
    return unsub;
  }, [assetId]);

  // Pausa o loop quando o hero sai da viewport (IntersectionObserver).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      threshold: 0.05,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Pausa quando a aba do navegador fica oculta.
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const active = inView && visible;

  return (
    <div ref={containerRef} className="h-full w-full">
      <Canvas
        frameloop={active ? 'always' : 'never'}
        dpr={[1, dpr]}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: true }}
        camera={{ position: [4, 2.5, 5], fov: 45 }}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} />
        <AdaptiveDpr pixelated />

        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 6, 4]} intensity={0.95} />
        <directionalLight position={[-4, 2, -3]} intensity={0.35} color="#7dd3fc" />

        <Suspense fallback={null}>
          {/* As labels moram DENTRO do grupo de propósito: assim herdam escala e
              offset do volume e não precisam de âncora recalculada por tipo. */}
          <group scale={setup.scale} position={[0, setup.yOffset, 0]}>
            {assetType === 'motor' ? (
              <ModelErrorBoundary fallback={<MotorPrimitive telemetryRef={telemetryRef} tempLimits={tempLimits} />}>
                <MotorModel telemetryRef={telemetryRef} tempLimits={tempLimits} />
              </ModelErrorBoundary>
            ) : (
              <MachineVolume assetId={assetId} type={assetType} />
            )}
            <LiveLabels assetId={assetId} setup={setup} />
          </group>
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={3}
          maxDistance={9}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 1.9}
        />
      </Canvas>
    </div>
  );
}
