import React from 'react';
import { createPortal } from 'react-dom';
import { Asset, Alert, Sensor, SensorHistorySeries } from '../types';
import { translations } from '../translations';
import { statusLabel } from '../utils/plantStatus';

interface AssetReportProps {
  asset: Asset;
  alerts: Alert[];
  language: 'pt' | 'en';
  /** Série das últimas 2h, janela fixa do relatório (ver AssetMonitorPage). */
  history2h: SensorHistorySeries[];
}

/**
 * Média das últimas 2h por sensor. A leitura instantânea sozinha não diz se o
 * valor é um pico isolado ou o patamar atual — a média dá essa referência.
 */
const meanBySensor = (series: SensorHistorySeries[]): Map<string, number> => {
  const out = new Map<string, number>();
  for (const s of series) {
    const values = s.data.map((d) => d.value).filter((v) => typeof v === 'number' && isFinite(v));
    if (values.length > 0) {
      out.set(s.sensorName, values.reduce((a, b) => a + b, 0) / values.length);
    }
  }
  return out;
};

/** Estados possíveis no relatório, já normalizados para as classes de cor. */
type StatusKey = 'normal' | 'warning' | 'critical' | 'offline' | 'info';

/**
 * Forma distinta por estado. É o canal secundário obrigatório: crítico (#d03b3b)
 * e normal (#0ca30c) ficam a ΔE 4.1 em deuteranopia — indistinguíveis para quem
 * tem daltonismo vermelho-verde, e cinzas idênticos numa impressora P&B. A cor
 * nunca carrega o estado sozinha; vem sempre com glifo + rótulo.
 */
const STATUS_GLYPH: Record<StatusKey, string> = {
  normal: '●',
  warning: '▲',
  critical: '■',
  offline: '○',
  info: '◆',
};

/** Severidade do modelo (ok/info/alerta/critico) → classe de estado do relatório. */
const SEVERITY_STATUS: Record<string, StatusKey> = {
  ok: 'normal',
  info: 'info',
  alerta: 'warning',
  critico: 'critical',
};

const StatusPill: React.FC<{ status: StatusKey; label: string }> = ({ status, label }) => (
  <span className={`rep-status rep-status-${status}`}>
    <span className="rep-glyph" aria-hidden>
      {STATUS_GLYPH[status]}
    </span>
    {label}
  </span>
);

/**
 * Bullet bar: leitura atual dentro da faixa do sensor, com marca no limite.
 * É a forma canônica para "medida contra alvo" — a barra dá a magnitude, o
 * traço vertical dá o limite, e o valor numérico continua na coluna ao lado,
 * então nada depende só do desenho.
 */
const SensorBullet: React.FC<{ sensor: Sensor }> = ({ sensor }) => {
  const span = sensor.max - sensor.min;
  // Faixa degenerada (min === max) tornaria a proporção uma divisão por zero.
  if (!isFinite(span) || span <= 0) return null;

  const pct = (v: number) => Math.max(0, Math.min(100, ((v - sensor.min) / span) * 100));
  const valuePct = pct(sensor.value);
  const thresholdPct = pct(sensor.threshold);
  const thresholdInRange = sensor.threshold > sensor.min && sensor.threshold < sensor.max;

  return (
    <span className="rep-bullet">
      <span className={`rep-bullet-fill rep-fill-${sensor.status}`} style={{ width: `${valuePct}%` }} />
      {thresholdInRange && (
        <span className="rep-bullet-threshold" style={{ left: `${thresholdPct}%` }} />
      )}
    </span>
  );
};

/**
 * Conteúdo da folha A4, sem o portal. Fica separado de `AssetReport` para poder
 * ser renderizado fora do app (harness de impressão) — `createPortal` não produz
 * saída em renderização para string, o que impediria conferir o layout impresso.
 */
export const AssetReportDocument: React.FC<AssetReportProps> = ({
  asset,
  alerts,
  language,
  history2h,
}) => {
  const means = meanBySensor(history2h);
  const t = translations[language].assetMonitor;
  const tr = translations[language].report;
  const np = translations[language].nameplate;
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';

  const activeAlerts = alerts.filter((a) => !a.resolved);
  const health = asset.healthIndex ?? Math.round(100 - asset.anomalyScore);
  const severity =
    asset.severity ??
    (health < 45 ? 'critico' : health < 65 ? 'alerta' : health < 85 ? 'info' : 'ok');
  const healthStatus = SEVERITY_STATUS[severity] ?? 'normal';
  const healthPct = Math.max(0, Math.min(100, health));

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale);
  };
  const fmtDateTime = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString(locale);
  };

  const field = (label: string, value: React.ReactNode) => (
    <div className="rep-field" key={label}>
      <span className="rep-field-label">{label}</span>
      <span className="rep-field-value">{value ?? '—'}</span>
    </div>
  );

  return (
    <div id="asset-report" lang={language}>
      {/* Cabeçalho */}
      <header className="rep-header">
        <div>
          <p className="rep-brand">Forzy · Industrial Digital Twin</p>
          <h1 className="rep-title">{tr.title}</h1>
          <p className="rep-subtitle">
            {asset.name} · {tr.types[asset.type]} · {asset.location}
          </p>
        </div>
        <div className="rep-header-meta">
          <p className="rep-tag">{asset.tag}</p>
          <p>
            {tr.generated_at} {new Date().toLocaleString(locale)}
          </p>
        </div>
      </header>

      {/* Painel de abertura: o estado do ativo antes de qualquer detalhe.
          O índice de saúde é o número-herói — um por documento. */}
      <section className="rep-summary">
        <div className="rep-hero">
          <span className="rep-field-label">{t.health}</span>
          <p className="rep-hero-value">
            {health}
            <em>/100</em>
          </p>
          {/* Medidor: preenchimento carrega a severidade, trilho é um passo
              claro da mesma cor, então o estado se lê na barra inteira. */}
          <span className="rep-meter">
            <span
              className={`rep-meter-fill rep-fill-${healthStatus}`}
              style={{ width: `${healthPct}%` }}
            />
          </span>
          <div className="rep-hero-foot">
            <StatusPill status={asset.status as StatusKey} label={statusLabel(asset.status, language)} />
            <span className="rep-hero-sev">
              {tr.severity}: <strong>{tr.severities[severity]}</strong>
            </span>
          </div>
        </div>

        <div className="rep-tiles">
          <div className="rep-tile">
            <span className="rep-field-label">{t.availability}</span>
            <p className="rep-tile-value">
              {asset.uptime.toFixed(1)}
              <em>%</em>
            </p>
          </div>
          <div className="rep-tile">
            <span className="rep-field-label">{t.active_alerts}</span>
            <p className="rep-tile-value">{activeAlerts.length}</p>
          </div>
          <div className="rep-tile">
            <span className="rep-field-label">{t.active_sensors}</span>
            <p className="rep-tile-value">{asset.sensors.length}</p>
          </div>
          <div className="rep-tile">
            <span className="rep-field-label">{tr.anomaly_score}</span>
            <p className="rep-tile-value">
              {Math.round(asset.anomalyScore)}
              <em>/100</em>
            </p>
          </div>
        </div>
      </section>

      {asset.insight && (
        <p className="rep-insight">
          <strong>{t.ai_insight}:</strong> {asset.insight}
        </p>
      )}

      {/* Identificação */}
      <section className="rep-section">
        <h2 className="rep-section-title">{tr.identification}</h2>
        <div className="rep-grid-3">
          {field(tr.name, asset.name)}
          {field(np.fields.tag, asset.tag)}
          {field(tr.type, tr.types[asset.type])}
          {field(tr.area, asset.area)}
          {field(tr.location, asset.location)}
          {field(
            t.thermal_residual,
            asset.thermalResidual == null ? '—' : `${asset.thermalResidual.toFixed(1)} °C`,
          )}
        </div>
      </section>

      {/* Telemetria */}
      <section className="rep-section">
        <h2 className="rep-section-title">{tr.telemetry}</h2>
        {asset.sensors.length === 0 ? (
          <p className="rep-empty">{tr.no_sensors}</p>
        ) : (
          <table className="rep-table">
            <thead>
              <tr>
                <th>{tr.col_sensor}</th>
                <th className="rep-num">{tr.col_value}</th>
                <th className="rep-num">{tr.col_mean_2h}</th>
                <th className="rep-bullet-col">{tr.col_range}</th>
                <th className="rep-num">{tr.col_threshold}</th>
                <th>{tr.status}</th>
              </tr>
            </thead>
            <tbody>
              {asset.sensors.map((s) => {
                const mean = means.get(s.name);
                // Só chama de alta/baixa o que sai de ±2% da média; abaixo disso
                // é ruído de leitura e uma seta viraria falso sinal.
                const drift = mean !== undefined && mean !== 0 ? (s.value - mean) / Math.abs(mean) : 0;
                const trend = mean === undefined ? '' : drift > 0.02 ? '▲' : drift < -0.02 ? '▼' : '=';
                return (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="rep-num">
                    <strong>{s.value.toFixed(1)}</strong> {s.unit}
                    {trend && <span className="rep-trend" title={tr.trend_hint}>{trend}</span>}
                  </td>
                  <td className="rep-num">
                    {mean === undefined ? (
                      <span className="rep-muted">—</span>
                    ) : (
                      <>
                        {mean.toFixed(1)} {s.unit}
                      </>
                    )}
                  </td>
                  <td className="rep-bullet-col">
                    <SensorBullet sensor={s} />
                    <span className="rep-bullet-scale">
                      {s.min}–{s.max} {s.unit}
                    </span>
                  </td>
                  <td className="rep-num">
                    {s.threshold} {s.unit}
                  </td>
                  <td>
                    <StatusPill status={s.status} label={statusLabel(s.status, language)} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="rep-legend">{tr.bullet_legend}</p>
      </section>

      {/* Alertas ativos */}
      <section className="rep-section">
        <h2 className="rep-section-title">
          {tr.active_alerts_title} ({activeAlerts.length})
        </h2>
        {activeAlerts.length === 0 ? (
          <p className="rep-empty">{t.no_alerts_title}</p>
        ) : (
          <table className="rep-table">
            <thead>
              <tr>
                <th>{tr.severity}</th>
                <th>{tr.col_alert}</th>
                <th>{tr.col_when}</th>
              </tr>
            </thead>
            <tbody>
              {activeAlerts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <StatusPill
                      status={a.severity === 'info' ? 'info' : a.severity}
                      label={tr.alert_severities[a.severity]}
                    />
                  </td>
                  <td>
                    <strong>{a.title}</strong>
                    <br />
                    <span className="rep-muted">{a.description}</span>
                  </td>
                  <td className="rep-nowrap">{fmtDateTime(a.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Manutenção */}
      <section className="rep-section">
        <h2 className="rep-section-title">{t.maintenance}</h2>
        <div className="rep-grid-3">
          {field(t.last_maintenance, fmtDate(asset.lastMaintenance))}
          {field(t.next_maintenance, fmtDate(asset.nextMaintenance))}
        </div>
      </section>

      {/* Placa — só sai quando o OCR já registrou os dados */}
      {asset.nameplate && (
        <section className="rep-section">
          <h2 className="rep-section-title">{np.title}</h2>
          <div className="rep-grid-3">
            {field(np.fields.manufacturer, asset.nameplate.manufacturer)}
            {field(np.fields.model, asset.nameplate.model)}
            {field(np.fields.serial, asset.nameplate.serialNumber)}
            {field(
              np.fields.power,
              `${asset.nameplate.power_kw} kW · ${asset.nameplate.power_cv} CV`,
            )}
            {field(np.fields.voltage, asset.nameplate.voltage)}
            {field(np.fields.current, `${asset.nameplate.current_a} A`)}
            {field(np.fields.rpm, `${asset.nameplate.rpm} rpm`)}
            {field(np.fields.poles, asset.nameplate.poles)}
            {field(np.fields.connection, asset.nameplate.connection)}
            {field(np.fields.frequency, `${asset.nameplate.frequency_hz} Hz`)}
            {field(np.fields.ip_class, asset.nameplate.ip_class)}
            {field(np.fields.insulation_class, asset.nameplate.insulation_class)}
            {field(np.fields.year, asset.nameplate.yearManufactured)}
          </div>
        </section>
      )}

      <footer className="rep-footer">{tr.footer}</footer>
    </div>
  );
};

/**
 * Monta a folha fora do #root: a casca do app usa `h-screen`/`overflow-hidden`,
 * que recortaria o documento na altura da viewport ao imprimir. Fica oculta na
 * tela; só o `@media print` do index.css a revela. As cores são fixas em tema
 * claro para não sair uma folha preta quando o app está em dark mode.
 */
export const AssetReport: React.FC<AssetReportProps> = (props) =>
  createPortal(<AssetReportDocument {...props} />, document.body);
