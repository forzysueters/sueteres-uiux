import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import { useAppStore } from '../../store/appStore';
import { MotorModel, MotorPrimitive, TelemetryData } from './MotorModel';

interface MotorViewerProps {
  assetId: string;
}

/** Lê a telemetria atual do ativo direto do store (sem hook/re-render). */
function readTelemetry(assetId: string): TelemetryData {
  const asset = useAppStore.getState().assets.find((a) => a.id === assetId);
  return {
    temperatura: asset?.sensors.find((s) => s.name === 'Temperatura')?.value ?? 25,
    vibracao: asset?.sensors.find((s) => s.name === 'Vibração')?.value ?? 0,
  };
}

/**
 * ErrorBoundary de cena: se o carregamento do .glb falhar, renderiza o motor
 * de primitivos (fallback) — a tela nunca quebra.
 */
class ModelErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.warn('[3d] falha ao carregar o modelo, usando fallback de primitivos:', err);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/** Labels HTML flutuantes — re-renderizam a 0,5Hz (tick do store), não a cena. */
function LiveLabels({ assetId }: MotorViewerProps) {
  const temp = useAppStore(
    (s) => s.assets.find((a) => a.id === assetId)?.sensors.find((x) => x.name === 'Temperatura')?.value,
  );
  const vib = useAppStore(
    (s) => s.assets.find((a) => a.id === assetId)?.sensors.find((x) => x.name === 'Vibração')?.value,
  );
  const hot = (temp ?? 0) > 80;

  return (
    <Html position={[0, 1.4, 0]} center occlude>
      <div
        className={`pointer-events-none flex select-none gap-2 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[10px] font-bold backdrop-blur-sm ${
          hot ? 'border-red-500/40 bg-red-500/15' : 'border-border bg-card/90'
        }`}
      >
        <span className={hot ? 'text-red-500' : 'text-foreground'}>
          {temp != null ? `${temp.toFixed(1)}°C` : '—'}
        </span>
        <span className="text-border-strong">·</span>
        <span className="text-foreground">
          {vib != null ? `${vib.toFixed(1)} mm/s` : '—'}
        </span>
      </div>
    </Html>
  );
}

export default function MotorViewer({ assetId }: MotorViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const telemetryRef = useRef<TelemetryData>(readTelemetry(assetId));
  const [inView, setInView] = useState(true);
  const [visible, setVisible] = useState(!document.hidden);
  const [dpr, setDpr] = useState(1.5);

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
          <ModelErrorBoundary fallback={<MotorPrimitive telemetryRef={telemetryRef} />}>
            <MotorModel telemetryRef={telemetryRef} />
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
