import {
  Bar,
  CartesianGrid,
  Legend,
  BarChart as RechartsBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface BarConfig {
  color: string;
  dataKey: string;
  label?: string;
  stackId?: string;
}

interface BarChartProps {
  bars: BarConfig[];
  data: Record<string, unknown>[];
  formatTooltip?: (value: number) => string;
  formatX?: (value: string) => string;
  height?: number;
  showLegend?: boolean;
  xKey?: string;
}

export function BarChartCard({
  data,
  bars,
  xKey = "date",
  height = 200,
  formatX,
  formatTooltip,
  showLegend = false,
}: BarChartProps) {
  return (
    <ResponsiveContainer height={height} width="100%">
      <RechartsBar barCategoryGap="20%" data={data}>
        <CartesianGrid
          stroke="#e5e3df"
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          axisLine={false}
          dataKey={xKey}
          tick={{ fontSize: 11, fill: "#6b7280", fontFamily: "Azeret Mono" }}
          tickFormatter={formatX}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          tick={{ fontSize: 11, fill: "#6b7280", fontFamily: "Azeret Mono" }}
          tickLine={false}
          width={50}
        />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e5e3df",
            borderRadius: 8,
            fontFamily: "Azeret Mono",
            fontSize: 12,
            color: "#1a1a1a",
            boxShadow: "0 8px 20px rgba(0, 0, 0, 0.08)",
          }}
          cursor={{ fill: "rgba(200,164,85,0.08)" }}
          formatter={(value: number | string) => [
            formatTooltip
              ? formatTooltip(Number(value))
              : Number(value).toLocaleString(),
          ]}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{
              fontSize: 11,
              fontFamily: "Hanken Grotesk",
              color: "#918799",
            }}
          />
        )}
        {bars.map((bar) => (
          <Bar
            dataKey={bar.dataKey}
            fill={bar.color}
            key={bar.dataKey}
            name={bar.label ?? bar.dataKey}
            radius={[4, 4, 0, 0]}
            stackId={bar.stackId}
          />
        ))}
      </RechartsBar>
    </ResponsiveContainer>
  );
}
