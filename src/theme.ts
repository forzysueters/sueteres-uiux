/** Estilo do tooltip do Recharts — único ponto de estilo de gráfico compartilhado hoje. */
export const tooltipStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border-strong)',
  borderRadius: '0.75rem',
  color: 'var(--foreground)',
  fontSize: '12px',
  padding: '10px 14px',
  boxShadow: '0 12px 32px -8px hsl(var(--shadow-color) / 0.6)',
};

/**
 * Cor das linhas do tooltip para séries que NÃO levam cor no payload.
 *
 * O Recharts monta cada item com `color: entry.color || '#000'` inline no
 * <li>, e o `color` do `contentStyle` nunca chega lá. Linhas e áreas mandam o
 * `stroke` no payload e ficam coloridas; a Pie não manda nada — o `fill` vive
 * na <Cell> —, então caía no preto fixo e sumia contra o card do tema escuro.
 * Só o `itemStyle` vence o inline.
 */
export const tooltipItemStyle = {
  color: 'var(--foreground)',
  fontSize: '12px',
  fontWeight: 600,
};
