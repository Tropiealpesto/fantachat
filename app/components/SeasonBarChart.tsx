"use client";

import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, Cell, ReferenceLine } from "recharts";

type HistoryItem = {
  matchday_number: number;
  score: number;
};

export default function SeasonBarChart(props: { history: HistoryItem[]; totalMatchdays?: number }) {
  const total = props.totalMatchdays ?? 38;

  // Mappa punteggi per giornata
  const map = useMemo(() => {
    const m = new Map<number, number>();
    props.history.forEach((h) => m.set(h.matchday_number, Number(h.score)));
    return m;
  }, [props.history]);

  // Crea dataset completo 1..38
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

  // Etichetta sopra o sotto in base al segno
  const renderLabel = (p: any) => {
    const value = Number(p.value);
    if (!value) return null;

    const isPos = value > 0;
    const fill = isPos ? "var(--primary)" : "var(--accent)";
    const offset = isPos ? -10 : 16;

    return (
      <text
        x={p.x + p.width / 2}
        y={p.y + offset}
        textAnchor="middle"
        fill={fill}
        fontWeight={900}
        fontSize={12}
      >
        {formatScore(value)}
      </text>
    );
  };

  return (
    <div style={{ width: "100%", height: 250 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
          <XAxis dataKey="md" tick={{ fontSize: 12 }} interval={0} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(v: any) => formatScore(Number(v))}
            labelFormatter={(l: any) => `Giornata ${l}`}
          />
          <ReferenceLine y={0} stroke="#94a3b8" />

          <Bar dataKey="score" radius={[8, 8, 8, 8]}>
            {data.map((d, idx) => {
              const v = d.score;
              const fill =
                v > 0 ? "var(--primary)" : v < 0 ? "var(--accent)" : "#cbd5e1";
              return <Cell key={idx} fill={fill} />;
            })}
            <LabelList dataKey="score" content={renderLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
