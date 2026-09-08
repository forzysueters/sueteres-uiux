import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { tooltipStyle } from '../theme';
import { useAppStore } from '../store/appStore';
import { translations } from '../translations';

interface TimeSeriesData {
  timestamp: string;
  value: number;
  threshold?: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
  title: string;
  dataKey: string;
  unit: string;
  color?: string;
  thresholdKey?: string;
  type?: 'line' | 'area';
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  title,
  dataKey,
  unit,
  color = 'var(--primary)',
  thresholdKey,
  type = 'area',
}) => {
  const { language } = useAppStore();
  const thresholdLabel = translations[language].sensorGauge.threshold;
  const ChartComponent = type === 'area' ? AreaChart : LineChart;
  const gradId = `ts-gradient-${dataKey}`;

  return (
    <div className="saas-card p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
        />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ChartComponent data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="timestamp"
            stroke="var(--border)"
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="var(--border)"
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            unit={` ${unit}`}
            width={52}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [`${value.toFixed(2)} ${unit}`, dataKey]}
            labelFormatter={(label) => new Date(label).toLocaleTimeString()}
            cursor={{ stroke: 'rgba(var(--primary-rgb), 0.3)', strokeWidth: 1 }}
          />
          {type === 'area' ? (
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: 'var(--card)', strokeWidth: 2 }}
              name={dataKey}
              isAnimationActive={false}
            />
          ) : (
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: 'var(--card)', strokeWidth: 2 }}
              name={dataKey}
              isAnimationActive={false}
            />
          )}
          {thresholdKey && (
            type === 'area' ? (
              <Area
                type="monotone"
                dataKey={thresholdKey}
                stroke="#f59e0b"
                fill="none"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                dot={false}
                name={thresholdLabel}
                isAnimationActive={false}
              />
            ) : (
              <Line
                type="monotone"
                dataKey={thresholdKey}
                stroke="#f59e0b"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                dot={false}
                name={thresholdLabel}
                isAnimationActive={false}
              />
            )
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
};
