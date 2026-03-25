"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, LabelList, Cell, ReferenceLine,
} from "recharts";

type HistoryItem = {
  matchday_number: number;
  score: number;
};

export default function SeasonBarChart(props: { history: HistoryItem[]; totalMatchdays?: number }) {
  const total = props.totalMatchdays ?? 38;

  const map = useMemo(() => {
    const m = new Map<number, number>();
    props.history.forEach((h) => m.set(h.matchday_number, Number(h.score)));
    return m;
  }, [props.history]);

  const data = useMemo(() => {
    const arr: { md: number; score: number }[] = [];
    for (let i = 1; i <= total; i++) {
      arr.push({ md: i, score: map.get(i) ?? 0 });
    }
    return arr;
  }, [map, total]);

  const formatScore = (v: number) => {
    const x = Math.round(v * 10) / 10;
    return String(x).replace(".", ",");
  };

  const renderLabel = (p: any) => {
    const value = Number(p.value);
    if (!value) return null;
    if (Math.abs(value) < 1.5) return null;

    const isPos = value > 0;

    // Positivi: etichetta sopra la barra
    // Negativi: p.y è il top (zero line), p.height scende verso il basso
    //           quindi il fondo è p.y + p.height → etichetta sotto il fondo
    const y = isPos ? p.y - 5 : p.y + p.height + 11;

    return (
      <text
        x={p.x + p.width / 2}
        y={y}
        textAnchor="middle"
        fill={isPos ? "#4ade80" : "#fb923c"}
        fontWeight={700}
        fontSize={10}
      >
        {formatScore(value)}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const v = Number(payload[0].value);
    const color = v > 0 ? "#4ade80" : v < 0 ? "#fb923c" : "#94a3b8";
    return (
      <div style={{
        background: "rgba(15,23,42,0.92)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding: "8px 12px",
        fontSize: 13,
        fontWeight: 700,
        color: "#fff",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontWeight: 500, marginBottom: 2 }}>
          Giornata {label}
        </div>
        <div style={{ color, fontSize: 16 }}>{formatScore(v)}</div>
      </div>
    );
  };

  return (
    <div style={{ width: "100%", height: 160 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 18, right: 4, left: -28, bottom: 14 }} barCategoryGap="20%">
          <XAxis
            dataKey="md"
            tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)", fontWeight: 500 }}
            interval={4}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }}
            axisLine={false}
            tickLine={false}
            tickCount={5}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.06)" }} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
          <Bar dataKey="score" radius={[4, 4, 4, 4]} maxBarSize={10}>
            {data.map((d, idx) => (
              <Cell
                key={idx}
                fill={d.score > 0 ? "#4ade80" : d.score < 0 ? "#fb923c" : "rgba(255,255,255,0.15)"}
                fillOpacity={d.score === 0 ? 0.4 : 0.9}
              />
            ))}
            <LabelList dataKey="score" content={renderLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
