"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  data: { date: string; value: number }[];
  color: string;
  unit: string;
  label: string;
}

/** Mini-grafico dell'andamento di una misura (caricato solo quando serve) */
export default function MeasurementSparkline({ data, color, unit, label }: Props) {
  return (
    <ResponsiveContainer width="100%" height={80}>
      <LineChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
        <YAxis domain={["auto", "auto"]} hide />
        <Tooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [`${v}${unit}`, label]}
          labelStyle={{ color: "hsl(var(--muted-foreground))" }}
        />
        <Line dataKey="value" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
