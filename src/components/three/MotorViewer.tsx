import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import { useAppStore } from '../../store/appStore';
import { MotorModel, MotorPrimitive, TelemetryData } from './MotorModel';
import { ModelErrorBoundary } from './ModelErrorBoundary';
import { sensorByRole, statusFor, limitFor } from '../../services/sensorLimits';

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

// ─── Âncoras das labels em world-space ───────────────────────────────────────
// O GLB veio numa malha única, sem nós nomeados (ver MotorModel.tsx), então
// ancoramos por offset fixo em torno do modelo (Center scale={6}). A âncora de
// TEMP fica sobre o mancal do lado acionado — o mesmo ponto de onde o gradiente
// térmico nasce no shader (HOTSPOT_END em MotorModel.tsx); se você inverter lá,
// inverta o sinal de X aqui. VIBRAÇÃO fica na traseira, lado do ventilador.
const TEMP_ANCHOR: [number, number, number] = [1.4, 0.5, 0.8];
const VIB_ANCHOR: [number, number, number] = [-1.4, 0.5, -0.8];

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
function LiveLabels({ assetId }: MotorViewerProps) {
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
  const tempAlert = tempSensor != null && statusFor(tempSensor.name, tempSensor.value, assetId) !== 'normal';
  const vibAlert = vibSensor != null && statusFor(vibSensor.name, vibSensor.value, assetId) !== 'normal';

  return (
    <>
      <Html position={TEMP_ANCHOR} center occlude>
        <InstrumentLabel
          caption="Temp · Mancal DE"
          value={temp != null ? temp.toFixed(1) : '—'}
          unit="°C"
          alert={tempAlert}
        />
      </Html>
      <Html position={VIB_ANCHOR} center occlude>
        <InstrumentLabel
          caption="Vibração · Traseira"
          value={vib != null ? vib.toFixed(1) : '—'}
          unit="mm/s"
          alert={vibAlert}
        />
      </Html>
    </>
  );
}

export default function MotorViewer({ assetId }: MotorViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const telemetryRef = useRef<TelemetryData>(readTelemetry(assetId));
  const [inView, setInView] = useState(true);
  const [visible, setVisible] = useState(!document.hidden);
  const [dpr, setDpr] = useState(1.5);

  // Limites da temperatura DESTE ativo: o glow acende no `warn` e satura no
  // `crit`, os mesmos cortes que pintam o gauge e disparam o alerta.
  const tempLimits = useMemo(() => {
    const sensors = useAppStore.getState().assets.find((a) => a.id === assetId)?.sensors ?? [];
    const sensor = sensorByRole(sensors, 'temperature');
    const limit = sensor ? limitFor(sensor.name, assetId) : null;
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
          <ModelErrorBoundary fallback={<MotorPrimitive telemetryRef={telemetryRef} tempLimits={tempLimits} />}>
            <MotorModel telemetryRef={telemetryRef} tempLimits={tempLimits} />
          </ModelErrorBoundary>
          <LiveLabels assetId={assetId} />
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
