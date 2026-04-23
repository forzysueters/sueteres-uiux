import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

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
  color = '#3b82f6',
  thresholdKey,
  type = 'line',
}) => {
  const ChartComponent = type === 'area' ? AreaChart : LineChart;
  const LineComponent = type === 'area' ? Area : Line;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-slate-100 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <ChartComponent data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
          <XAxis
            dataKey="timestamp"
            stroke="rgba(148, 163, 184, 0.5)"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          />
          <YAxis stroke="rgba(148, 163, 184, 0.5)" tick={{ fontSize: 12 }} label={{ value: unit, angle: -90, position: 'insideLeft' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
            }}
            formatter={(value: number) => [value.toFixed(2), dataKey]}
            labelFormatter={(label) => new Date(label).toLocaleString()}
          />
          <Legend />
          {type === 'area' ? (
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={`url(#gradient-${dataKey})`}
              name={dataKey}
            />
          ) : (
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              dot={false}
              strokeWidth={2}
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
                strokeDasharray="5 5"
                name="Threshold"
              />
            ) : (
              <Line
                type="monotone"
                dataKey={thresholdKey}
                stroke="#f59e0b"
                strokeDasharray="5 5"
                dot={false}
                strokeWidth={1}
                name="Threshold"
              />
            )
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
};
