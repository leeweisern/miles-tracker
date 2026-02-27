import {
  Area,
  CartesianGrid,
  AreaChart as RechartsArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface AreaChartProps {
  color?: string;
  data: Record<string, unknown>[];
  dataKey: string;
  formatTooltip?: (value: number) => string;
  formatX?: (value: string) => string;
  gradientId?: string;
  height?: number;
  xKey?: string;
  yDomain?: [number | string, number | string];
}

export function AreaChartCard({
  data,
  dataKey,
  xKey = "date",
  color = "#c8a455",
  gradientId = "areaGrad",
  height = 200,
  yDomain,
  formatTooltip,
  formatX,
}: AreaChartProps) {
  return (
    <ResponsiveContainer height={height} width="100%">
      <RechartsArea data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="#2e2a38"
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          axisLine={false}
          dataKey={xKey}
          tick={{ fontSize: 11, fill: "#918799", fontFamily: "Azeret Mono" }}
          tickFormatter={formatX}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          domain={yDomain}
          tick={{ fontSize: 11, fill: "#918799", fontFamily: "Azeret Mono" }}
          tickLine={false}
          width={50}
        />
        <Tooltip
          contentStyle={{
            background: "#252230",
            border: "1px solid #3d3748",
            borderRadius: 8,
            fontFamily: "Azeret Mono",
            fontSize: 12,
            color: "#eee8df",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
          formatter={(value: number | string) => [
            formatTooltip
              ? formatTooltip(Number(value))
              : Number(value).toLocaleString(),
            dataKey,
          ]}
          itemStyle={{ color: "#c8a455" }}
        />
        <Area
          activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
          dataKey={dataKey}
          dot={false}
          fill={`url(#${gradientId})`}
          stroke={color}
          strokeWidth={2}
          type="monotone"
        />
      </RechartsArea>
    </ResponsiveContainer>
  );
}
