import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { usePermissions } from '../hooks/usePermissions';
import { translations } from '../translations';
import { statusLabel } from '../utils/plantStatus';
import { apiService } from '../services/api';
import { useAssetRealtime } from '../hooks/useAssetRealtime';
import { useNextInsight } from '../hooks/useNextInsight';
import { useAlerts } from '../hooks/useAlerts';
import { SensorGauge } from '../components/SensorGauge';
import { NameplateCard } from '../components/NameplateCard';
import { NameplateEditor } from '../components/NameplateEditor';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { KPICard } from '../components/Cards';
import { HealthGauge } from '../components/HealthGauge';
import { PageLoader } from '../components/SkeletonLoaders';
import { AssetReport } from '../components/AssetReport';
import { generateAssetReportPdf } from '../utils/reportPdf';
import { MaintenanceScheduler } from '../components/MaintenanceScheduler';
import { SensorHistorySeries } from '../types';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { toast } from 'sonner';
import {
  ArrowLeft, Activity, Tag, AlertTriangle, CheckCircle2, TrendingUp,
  Sparkles, Zap, Shield, RefreshCw, Gauge, Bell, Download,
  Thermometer, Clock, Box, Printer, Mail, Loader2, ChevronDown, Pencil,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useIsMobile } from '../hooks/useMediaQuery';

// Visualizador 3D carregado sob demanda — mantém o bundle three fora do
// caminho crítico da renderização inicial da rota.
const MotorViewer = lazy(() => import('../components/three/MotorViewer'));

const RANGES = ['1h', '6h', '24h', '7d'] as const;

type Tab = 'sensors' | 'history' | 'nameplate' | 'alerts';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

export const AssetMonitorPage: React.FC = () => {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const { assets, setAssets, updateAsset, darkMode, language } = useAppStore();
  // Corrigir a placa à mão é faixa 2: o técnico registra placa nova pelo OCR,
  // mas não reescreve os valores de uma já cadastrada.
  const { can } = usePermissions();
  const mayEditNameplate = can('nameplate:edit');
  const t = translations[language].assetMonitor;
  const common = translations[language].common;
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';
  const isMobile = useIsMobile();

  const [tab, setTab] = useState<Tab>('sensors');
  const [editingNameplate, setEditingNameplate] = useState(false);
  const [historyRange, setHistoryRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [history, setHistory] = useState<SensorHistorySeries[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // Janela própria do relatório. Não reaproveita `history` porque aquela segue a
  // faixa que o usuário escolhe no gráfico — a "média 2h" mudaria de sentido.
  const [history2h, setHistory2h] = useState<SensorHistorySeries[]>([]);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  const { alerts, resolveAlert } = useAlerts(assetId);
  const [assetsLoading, setAssetsLoading] = useState(assets.length === 0);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  // Load assets if not already in store — necessário para link direto/refresh
  // nesta rota, onde o store pode estar vazio no primeiro render.
  useEffect(() => {
    if (assets.length > 0) {
      setAssetsLoading(false);
      return;
    }
    setAssetsLoading(true);
    apiService
      .getAssets()
      .then((data) => {
        setAssets(data);
        setAssetsError(null);
      })
      .catch((err) => setAssetsError(err instanceof Error ? err.message : t.load_error))
      .finally(() => setAssetsLoading(false));
  }, []);

  const asset = assets.find((a) => a.id === assetId);

  // Realtime updates
  useAssetRealtime(assetId ?? null);

  // Load history
  //
  // `silent` recarrega sem acender o spinner: a série cresce a cada 10s com o
  // cenário agendado (0018), e piscar o esqueleto de carregamento a cada
  // atualização deixaria o gráfico ilegível. Só a primeira carga e a troca de
  // janela mostram carregamento.
  const loadHistory = React.useCallback(
    async (silent = false) => {
      if (!assetId) return;
      if (!silent) setHistoryLoading(true);
      try {
        const data = await apiService.getSensorHistory(assetId, historyRange);
        setHistory(data);
        // A janela nova pode não ter leitura do sensor que estava aberto. Manter
        // a seleção antiga deixaria a aba pedindo "selecione um sensor acima"
        // com o sensor já marcado nos chips — escolhe o primeiro disponível.
        setSelectedSensor((prev) =>
          prev && data.some((d) => d.sensorName === prev) ? prev : (data[0]?.sensorName ?? null),
        );
      } catch {
        // Sem o catch a promise rejeitada deixava o spinner girando para sempre.
        if (!silent) setHistory([]);
      } finally {
        if (!silent) setHistoryLoading(false);
      }
    },
    [assetId, historyRange],
  );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // O histórico é série temporal viva, não uma foto tirada quando a tela abriu.
  // A telemetria entra a cada 10s; 30s de intervalo mantém o gráfico andando
  // sem transformar a página aberta num gerador de consultas.
  useEffect(() => {
    const id = window.setInterval(() => void loadHistory(true), 30_000);
    return () => window.clearInterval(id);
  }, [loadHistory]);

  // Quando o avaliador publica o diagnóstico novo, releem-se ativo e série.
  const nextInsight = useNextInsight(() => {
    if (assetId) void apiService.getAssetById(assetId).then((a) => a && updateAsset(a));
    void loadHistory(true);
  });

  useEffect(() => {
    if (!assetId) return;
    apiService
      .getSensorHistory(assetId, '2h')
      .then(setHistory2h)
      .catch(() => setHistory2h([])); // relatório degrada para "—", não quebra a página
  }, [assetId]);

  if (assetsLoading) {
    return <PageLoader label={t.loading} />;
  }

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center">
          <Activity size={28} className="text-muted" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">
            {assetsError ? t.load_error : t.not_found_title}
          </p>
          <p className="text-sm text-muted mt-1">
            {assetsError ?? t.not_found_desc}
          </p>
        </div>
        <button onClick={() => navigate('/planta')} className="btn-ghost text-sm">
          <ArrowLeft size={15} />
          {t.back_to_plant}
        </button>
      </div>
    );
  }

  const statusConfig = {
    critical: { text: 'text-red-500', dot: 'bg-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', glow: 'rgba(239,68,68,0.30)' },
    warning:  { text: 'text-amber-500', dot: 'bg-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', glow: 'rgba(245,158,11,0.28)' },
    normal:   { text: 'text-emerald-500', dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'rgba(16,185,129,0.26)' },
    offline:  { text: 'text-slate-500', dot: 'bg-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20', glow: 'rgba(100,116,139,0.22)' },
  };
  const cfg = statusConfig[asset.status] || statusConfig.normal;

  // O navegador usa o document.title como nome sugerido do PDF; sem trocar,
  // todo relatório sairia salvo como "IDT Platform…". Restaura no afterprint
  // porque o Safari retoma a execução antes de a caixa de impressão fechar.
  const handlePrint = () => {
    const previousTitle = document.title;
    document.title = `${asset.tag} — ${translations[language].report.title}`;
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  /**
   * Manda o mesmo relatório por e-mail. O corpo é montado no servidor a partir
   * do banco; aqui só se produz o PDF anexo — e, se a rasterização falhar, o
   * e-mail sai mesmo assim, sem anexo.
   */
  const handleEmailReport = async () => {
    setSendingReport(true);
    const pending = toast.loading(t.report_sending);
    try {
      const pdf = await generateAssetReportPdf();
      const result = await apiService.sendAssetReportEmail(asset.id, language, pdf ?? undefined);

      if (result.ok) {
        toast.success(t.report_sent.replace('{email}', result.sent[0] ?? ''), { id: pending });
      } else {
        toast.error(result.reason === 'not_configured' ? t.report_not_configured : t.report_failed, {
          id: pending,
        });
      }
    } finally {
      setSendingReport(false);
    }
  };

  const activeAlerts = alerts.filter((a) => !a.resolved);
  const currentHistory = selectedSensor ? history.find((h) => h.sensorName === selectedSensor) : null;

  // Diagnóstico do modelo de anomalia (Índice de Saúde: maior = melhor).
  const health = asset.healthIndex ?? Math.round(100 - asset.anomalyScore);
  const severity =
    asset.severity ??
    (health < 45 ? 'critico' : health < 65 ? 'alerta' : health < 85 ? 'info' : 'ok');
  const insightColor =
    severity === 'critico'
      ? 'text-red-600 dark:text-red-300'
      : severity === 'alerta'
        ? 'text-amber-700 dark:text-amber-200/80'
        : 'text-emerald-700 dark:text-emerald-200/80';

  const tabs: { id: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'sensors',   label: t.tab_sensors,   icon: Activity },
    { id: 'history',   label: t.tab_history,   icon: TrendingUp },
    { id: 'nameplate', label: t.tab_nameplate, icon: Tag },
    { id: 'alerts',    label: t.tab_alerts,    icon: AlertTriangle, badge: activeAlerts.length },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* ───────── Barra de ações fixa ───────── */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-3 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <button
              onClick={() => navigate('/planta')}
              className="flex items-center gap-1.5 text-muted hover:text-foreground transition-colors flex-shrink-0"
            >
              <ArrowLeft size={16} />
              {t.breadcrumb_plant}
            </button>
            <span className="text-border-strong">/</span>
            <span className="text-muted truncate">{asset.area}</span>
            <span className="text-border-strong">/</span>
            <span className="text-foreground font-semibold font-mono">{asset.tag}</span>
          </div>
          <div data-tour="asset-actions" className="flex items-center gap-2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="btn-ghost text-xs" title={t.export_hint} disabled={sendingReport}>
                  {sendingReport ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {t.export}
                  <ChevronDown size={12} className="opacity-60" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-50 min-w-[15rem] rounded-xl border border-border bg-card p-1 shadow-xl"
                >
                  <DropdownMenu.Item
                    onSelect={handlePrint}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-card-hover"
                  >
                    <Printer size={14} className="mt-0.5 flex-shrink-0 text-muted" />
                    <span>
                      <span className="block text-xs font-medium text-foreground">{t.export_print}</span>
                      <span className="block text-[11px] text-muted">{t.export_print_hint}</span>
                    </span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={handleEmailReport}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-card-hover"
                  >
                    <Mail size={14} className="mt-0.5 flex-shrink-0 text-muted" />
                    <span>
                      <span className="block text-xs font-medium text-foreground">{t.export_email}</span>
                      <span className="block text-[11px] text-muted">{t.export_email_hint}</span>
                    </span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <button className="btn-primary text-xs" onClick={() => setSchedulerOpen(true)}>
              <Shield size={14} />
              {t.schedule_maintenance}
            </button>
          </div>
        </div>
      </div>

      {/* ───────── Identidade do ativo ───────── */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center border flex-shrink-0', cfg.bg, cfg.border)}>
          <Activity size={24} className={cfg.text} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary font-mono bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
              <Tag size={11} />
              {asset.tag}
            </span>
            <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider', cfg.text)}>
              <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', cfg.dot)} />
              {statusLabel(asset.status, language)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <span className="live-dot scale-75" />
              {t.live} · 2s
            </span>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground tracking-tight break-words">{asset.name}</h1>
            <p className="text-sm text-muted">{asset.location}</p>
          </div>
        </div>
        <span className="ml-auto hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card-hover text-[10px] font-semibold uppercase tracking-wider text-muted">
          <Gauge size={11} className="text-primary" />
          {t.monitoring}
        </span>
      </motion.div>

      {/* ───────── Gêmeo Digital 3D (protagonista, full-width) ───────── */}
      <motion.div
        variants={itemVariants}
        className="relative -mx-4 sm:-mx-6 md:-mx-8 h-[50vh] min-h-[320px] sm:min-h-[420px] overflow-hidden border-y border-border bg-background/40"
      >
        {/* Atmosfera reativa ao status */}
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] rounded-full blur-3xl opacity-50 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${cfg.glow}, transparent 70%)` }}
        />
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 pointer-events-none',
            darkMode ? 'grid-pattern opacity-[0.35]' : 'grid-pattern-light opacity-[0.5]',
          )}
        />

        {/* Canvas 3D — preenche todo o hero */}
        <Suspense
          fallback={
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted">
              <RefreshCw size={22} className="animate-spin text-primary" />
              <span className="text-[11px] font-medium">{t.loading_model_3d}</span>
            </div>
          }
        >
          <div className="absolute inset-0">
            <MotorViewer assetId={asset.id} />
          </div>
        </Suspense>

        {/* Overlay: placar de saúde (glassmorphism, flutuante) */}
        <div data-tour="health-index" className="absolute top-3 left-3 z-10 w-[150px] sm:top-4 sm:left-4 sm:w-[220px] rounded-2xl border border-border bg-white/70 dark:bg-slate-950/55 backdrop-blur-xl shadow-lg p-3 sm:p-4">
          <div className="flex flex-col items-center gap-3">
            <HealthGauge value={health} severity={severity} size={isMobile ? 104 : 150} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 w-full pt-3 border-t border-border">
              <div>
                <p className="text-[9px] text-muted uppercase tracking-widest flex items-center gap-1">
                  <Clock size={10} className="text-primary" />
                  {t.rul}
                </p>
                <p className="text-sm font-bold text-foreground tabular-nums">~{Math.round(health * 2.4)}d</p>
              </div>
              <div>
                <p className="text-[9px] text-muted uppercase tracking-widest flex items-center gap-1">
                  <Gauge size={10} className="text-primary" />
                  {t.health}
                </p>
                <p className="text-sm font-bold text-foreground tabular-nums">{health}/100</p>
              </div>
              {asset.thermalResidual != null && (
                <div className="sm:col-span-2">
                  <p className="text-[9px] text-muted uppercase tracking-widest flex items-center gap-1">
                    <Thermometer size={10} className="text-primary" />
                    {t.thermal_residual}
                  </p>
                  <p className="text-sm font-bold text-foreground tabular-nums">
                    {asset.thermalResidual > 0 ? '+' : ''}{asset.thermalResidual.toFixed(1)}°C
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Overlay: marcador do gêmeo digital */}
        <span className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-slate-950/55 border border-border text-[9px] font-bold uppercase tracking-wider text-muted backdrop-blur-md pointer-events-none">
          <Box size={11} className="text-primary" />
          {t.digital_twin_3d}
        </span>

        {/* Overlay: dica de interação */}
        <span className="absolute bottom-4 right-4 z-10 text-[10px] text-muted/80 pointer-events-none select-none">
          {t.drag_hint}
        </span>
      </motion.div>

      {/* ───────── Insight Preditivo IA (banner full-width) ─────────
          O banner aparece em QUALQUER severidade, inclusive 'ok'. Escondê-lo no
          ativo saudável fazia o diagnóstico parecer um aviso de erro que surge e
          some, em vez do que ele é: uma leitura contínua, que também tem valor
          quando diz "está tudo dentro do padrão". É essa continuidade que a
          contagem regressiva ao lado torna visível. */}
      {asset.insight && (
        <motion.div
          variants={itemVariants}
          className="rounded-xl bg-primary/5 border border-primary/10 overflow-hidden"
        >
          <div className="flex items-start gap-3 p-4">
            <Sparkles size={16} className="text-primary mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-xs font-bold text-primary">{t.ai_insight}</p>
                <p
                  className="text-[10px] font-semibold text-muted tabular-nums"
                  title={t.insight_cycle}
                >
                  {t.next_insight}{' '}
                  <span className="text-foreground-soft">{nextInsight.label}</span>
                </p>
              </div>
              <p className={cn('text-xs leading-relaxed', insightColor)}>{asset.insight}</p>
            </div>
          </div>
          {/* Barra do ciclo: enche em 5 min e zera junto com a próxima avaliação.
              `transition-none` porque o valor já anda de segundo em segundo —
              animar por cima faria a barra ficar sempre atrasada. */}
          <div className="h-[2px] w-full bg-primary/10">
            <div
              className="h-full bg-primary/50 transition-none"
              style={{ width: `${nextInsight.progress * 100}%` }}
            />
          </div>
        </motion.div>
      )}

      {/* ───────── KPIs premium ───────── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <KPICard title={t.availability} value={asset.uptime.toFixed(1)} unit="%" icon={Activity} accent="success" />
        <KPICard title={common.anomaly} value={asset.anomalyScore.toFixed(0)} unit="%" icon={Zap} accent={asset.anomalyScore >= 50 ? 'danger' : 'warning'} />
        <KPICard title={t.active_sensors} value={asset.sensors.length} icon={Gauge} accent="info" />
        <KPICard title={t.active_alerts} value={activeAlerts.length} icon={Bell} accent={activeAlerts.length > 0 ? 'danger' : 'success'} />
      </motion.div>

      {/* ───────── Abas ───────── */}
      <motion.div variants={itemVariants}>
        <div className="flex flex-wrap items-center gap-x-1 border-b border-border">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'group relative flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-semibold transition-colors flex-shrink-0 whitespace-nowrap',
                tab === id ? 'text-foreground' : 'text-muted hover:text-foreground-soft',
              )}
            >
              <Icon size={15} className={cn('transition-colors', tab === id ? 'text-primary' : 'text-muted group-hover:text-foreground-soft')} />
              {label}
              {badge != null && badge > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500/15 text-red-500 text-[10px] font-bold rounded-md border border-red-500/25">
                  {badge}
                </span>
              )}
              {tab === id && (
                <motion.div
                  layoutId="asset-tab-active"
                  className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full"
                  style={{ boxShadow: '0 -2px 12px rgba(var(--primary-rgb), 0.5)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="pt-6">
          {/* SENSORES */}
          {tab === 'sensors' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="section-title !mb-0">{t.realtime_telemetry}</span>
                {asset.sensors.length > 0 && (
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                    <span className="live-dot" />
                    {t.live} · 2s
                  </span>
                )}
              </div>
              {asset.sensors.length === 0 ? (
                // Ativo cadastrado pela placa nasce sem instrumentação. Sem este
                // aviso o grid renderia vazio, em silêncio, com uptime 100% e
                // score 0 — indistinguível de um equipamento saudável.
                <div className="saas-card p-8 flex flex-col items-center justify-center gap-2 text-center">
                  <div className="w-10 h-10 rounded-lg bg-card-hover border border-border flex items-center justify-center text-muted">
                    <Gauge size={18} />
                  </div>
                  <p className="font-bold text-sm text-foreground">{t.no_sensors_title}</p>
                  <p className="text-xs text-muted max-w-sm leading-relaxed">{t.no_sensors_desc}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {asset.sensors.map((sensor) => (
                    <SensorGauge key={sensor.id} sensor={sensor} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HISTÓRICO */}
          {tab === 'history' && (
            <div className="saas-card-premium p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <span className="section-title !mb-0">{t.sensor_history}</span>
                <div className="flex gap-1">
                  {RANGES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setHistoryRange(r)}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-[11px] font-bold transition-all',
                        historyRange === r ? 'bg-primary text-white' : 'bg-card-hover text-muted hover:text-foreground',
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Os chips só aparecem quando há série. Vazios, a linha virava um
                  espaço em branco e o "selecione um sensor acima" apontava para
                  lugar nenhum. O rótulo diz o que a linha é. */}
              {history.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                    {t.sensor_picker_label}
                  </span>
                  {history.map((h) => (
                    <button
                      key={h.sensorName}
                      aria-pressed={selectedSensor === h.sensorName}
                      onClick={() => setSelectedSensor(h.sensorName)}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-[11px] font-bold transition-all border',
                        selectedSensor === h.sensorName ? 'border-current' : 'border-transparent bg-card-hover text-muted hover:text-foreground',
                      )}
                      style={selectedSensor === h.sensorName ? { color: h.color, borderColor: h.color, background: `${h.color}15` } : {}}
                    >
                      {h.sensorName}
                    </button>
                  ))}
                </div>
              )}

              {historyLoading ? (
                <div className="h-56 flex items-center justify-center text-muted text-sm">
                  <RefreshCw size={16} className="animate-spin mr-2" />
                  {t.loading_history}
                </div>
              ) : asset.sensors.length === 0 ? (
                // Ativo sem instrumentação nunca terá histórico — a causa é outra,
                // e é a mesma que a aba de sensores explica.
                <div className="h-56 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <Gauge size={18} className="text-muted" />
                  <p className="text-sm font-bold text-foreground">{t.no_sensors_title}</p>
                  <p className="max-w-sm text-xs leading-relaxed text-muted">{t.no_sensors_desc}</p>
                </div>
              ) : history.length === 0 ? (
                // Tem sensor, mas nenhuma leitura caiu na janela escolhida.
                <div className="h-56 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <TrendingUp size={18} className="text-muted" />
                  <p className="text-sm font-bold text-foreground">{t.no_history_title}</p>
                  <p className="max-w-sm text-xs leading-relaxed text-muted">{t.no_history_desc}</p>
                </div>
              ) : currentHistory ? (
                <TimeSeriesChart
                  data={currentHistory.data.map((d) => ({ timestamp: d.timestamp, value: d.value }))}
                  title={currentHistory.sensorName}
                  dataKey="value"
                  unit={currentHistory.unit}
                  color={currentHistory.color}
                  type="area"
                />
              ) : (
                <div className="h-56 flex items-center justify-center text-muted text-sm">
                  {t.select_sensor}
                </div>
              )}
            </div>
          )}

          {/* PLACA */}
          {tab === 'nameplate' && (
            <div className="space-y-3">
              {asset.nameplate && editingNameplate ? (
                <NameplateEditor
                  assetId={asset.id}
                  nameplate={asset.nameplate}
                  onCancel={() => setEditingNameplate(false)}
                  onSaved={() => {
                    setEditingNameplate(false);
                    // A revisão vira a placa vigente na view; relê a frota para
                    // a tela (e o assistente) passarem a ver os novos valores.
                    apiService.getAssets().then(setAssets).catch(() => {});
                  }}
                />
              ) : asset.nameplate ? (
                <>
                  {mayEditNameplate && (
                    <div className="flex justify-end">
                      <button onClick={() => setEditingNameplate(true)} className="btn-ghost text-xs">
                        <Pencil size={14} />
                        {t.edit_nameplate}
                      </button>
                    </div>
                  )}
                  <NameplateCard nameplate={asset.nameplate} />
                </>
              ) : (
                <div className="saas-card flex flex-col items-center justify-center text-center py-16 px-6">
                  <div className="w-14 h-14 rounded-2xl bg-card-hover border border-border flex items-center justify-center mb-4">
                    <Tag size={26} className="text-muted" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{t.no_nameplate_title}</p>
                  <p className="text-xs text-muted mt-1 max-w-xs">
                    {t.no_nameplate_desc}
                  </p>
                  <button onClick={() => navigate('/equipamentos')} className="btn-ghost text-xs mt-4">
                    <Tag size={14} />
                    {t.go_to_equipment}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ALERTAS */}
          {tab === 'alerts' && (
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="saas-card flex flex-col items-center justify-center text-center py-16 px-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                    <CheckCircle2 size={26} className="text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{t.no_alerts_title}</p>
                  <p className="text-xs text-muted mt-1">{t.no_alerts_desc}</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      'p-4 rounded-xl border-l-4 saas-card',
                      alert.severity === 'critical' ? 'border-l-red-500' :
                      alert.severity === 'warning'  ? 'border-l-amber-500' :
                      'border-l-blue-500',
                      alert.resolved && 'opacity-60',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">{alert.title}</p>
                        <p className="text-xs text-muted mt-0.5">{alert.description}</p>
                        {alert.mlInsight && (
                          <p className="text-[10px] text-amber-300/80 mt-2 flex items-start gap-1">
                            <Sparkles size={10} className="text-primary mt-0.5 flex-shrink-0" />
                            {alert.mlInsight}
                          </p>
                        )}
                      </div>
                      {!alert.resolved && (
                        <button
                          onClick={() => resolveAlert(alert.id)}
                          className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 hover:text-emerald-400 transition-colors whitespace-nowrap"
                        >
                          <CheckCircle2 size={12} />
                          {t.resolve}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[9px] font-mono text-muted">{new Date(alert.timestamp).toLocaleString(locale)}</span>
                      {alert.resolved && <span className="text-[9px] font-bold text-emerald-500">{t.resolved}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ───────── Manutenção (persistente) ───────── */}
      <motion.div variants={itemVariants} className="saas-card p-5">
        <span className="section-title">{t.maintenance}</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: t.last_maintenance, date: asset.lastMaintenance, icon: CheckCircle2, color: 'text-emerald-500' },
            { label: t.next_maintenance, date: asset.nextMaintenance, icon: Zap, color: 'text-primary' },
          ].map(({ label, date, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-card-hover border border-border">
              <Icon size={18} className={color} />
              <div>
                <p className="text-[9px] text-muted uppercase tracking-wider">{label}</p>
                <p className="text-sm font-bold text-foreground">{new Date(date).toLocaleDateString(locale)}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Folha A4 do Exportar — invisível na tela, montada via portal no body. */}
      <AssetReport asset={asset} alerts={alerts} language={language} history2h={history2h} />

      <MaintenanceScheduler
        open={schedulerOpen}
        onOpenChange={setSchedulerOpen}
        asset={asset}
        language={language}
      />
    </motion.div>
  );
};
