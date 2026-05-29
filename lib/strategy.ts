import type { PublishedPost, Territory } from "./types";

export interface Insight {
  title: string;
  detail: string;
}

function er(p: PublishedPost): number {
  const m = p.metrics;
  return m.impressions ? (m.reactions + m.comments + m.shares + m.saves) / m.impressions : 0;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

interface KeyAgg {
  key: string;
  avg: number;
  n: number;
}

function avgBy(posts: PublishedPost[], keyFn: (p: PublishedPost) => string): KeyAgg[] {
  const m = new Map<string, { sum: number; n: number }>();
  for (const p of posts) {
    const k = keyFn(p);
    const c = m.get(k) ?? { sum: 0, n: 0 };
    c.sum += er(p);
    c.n += 1;
    m.set(k, c);
  }
  return [...m.entries()]
    .map(([key, v]) => ({ key, avg: v.sum / v.n, n: v.n }))
    .sort((a, b) => b.avg - a.avg);
}

export interface StrategyStats {
  n: number;
  avgEr: number;
  byFormat: KeyAgg[];
  byTerritory: KeyAgg[];
  byWeekday: KeyAgg[];
  byHour: KeyAgg[];
  lenTop: number;
  lenBottom: number;
  profileViews: number;
  followers: number;
  daysSince: number | null;
  avgGap: number | null;
  demographics: { dimension: string; top: { label: string; pct: number }[] }[];
  topPosts: { er: number; text: string; territory?: string }[];
}

export function computeStats(posts: PublishedPost[]): StrategyStats | null {
  const valid = posts.filter((p) => p.metrics.impressions > 0);
  if (valid.length === 0) return null;

  const avgEr = valid.reduce((s, p) => s + er(p), 0) / valid.length;
  const ranked = [...valid].sort((a, b) => er(b) - er(a));
  const third = Math.max(1, Math.round(ranked.length / 3));
  const lenTop = Math.round(
    ranked.slice(0, third).reduce((s, p) => s + p.text.length, 0) / third,
  );
  const lenBottom = Math.round(
    ranked.slice(-third).reduce((s, p) => s + p.text.length, 0) / third,
  );

  const dates = valid
    .filter((p) => p.postedAt)
    .map((p) => new Date(p.postedAt + "T12:00:00").getTime())
    .sort((a, b) => a - b);
  let daysSince: number | null = null;
  let avgGap: number | null = null;
  if (dates.length) {
    daysSince = Math.floor((Date.now() - dates[dates.length - 1]) / 86400000);
    if (dates.length >= 2) {
      let sum = 0;
      for (let i = 1; i < dates.length; i++) sum += (dates[i] - dates[i - 1]) / 86400000;
      avgGap = sum / (dates.length - 1);
    }
  }

  const demoMap = new Map<string, Map<string, { sum: number; n: number }>>();
  for (const p of valid) {
    if (!p.demographics) continue;
    for (const [dim, entries] of Object.entries(p.demographics)) {
      const dm = demoMap.get(dim) ?? new Map<string, { sum: number; n: number }>();
      for (const e of entries) {
        const c = dm.get(e.label) ?? { sum: 0, n: 0 };
        c.sum += e.pct;
        c.n += 1;
        dm.set(e.label, c);
      }
      demoMap.set(dim, dm);
    }
  }
  const demographics = [...demoMap.entries()].map(([dimension, dm]) => ({
    dimension,
    top: [...dm.entries()]
      .map(([label, v]) => ({ label, pct: v.sum / v.n }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3),
  }));

  return {
    n: valid.length,
    avgEr,
    byFormat: avgBy(valid, (p) => p.format),
    byTerritory: avgBy(valid, (p) => p.territory?.trim() || "(sem território)"),
    byWeekday: avgBy(
      valid.filter((p) => p.postedAt),
      (p) => String(new Date(p.postedAt + "T12:00:00").getDay()),
    ),
    byHour: avgBy(
      valid.filter((p) => p.postedTime),
      (p) => String(parseInt(p.postedTime!.split(":")[0], 10)),
    ),
    lenTop,
    lenBottom,
    profileViews: valid.reduce((s, p) => s + p.metrics.profileViews, 0),
    followers: valid.reduce((s, p) => s + p.metrics.followers, 0),
    daysSince,
    avgGap,
    demographics,
    topPosts: ranked.slice(0, 3).map((p) => ({
      er: er(p),
      text: p.text,
      territory: p.territory,
    })),
  };
}

export function buildInsights(stats: StrategyStats | null): Insight[] {
  if (!stats) {
    return [
      {
        title: "Sem dados ainda",
        detail: "Registre posts publicados (importe os arquivos do LinkedIn) para receber recomendações.",
      },
    ];
  }
  if (stats.n < 3) {
    return [
      {
        title: "Registre mais alguns posts",
        detail: `Você tem ${stats.n} post(s) medido(s). Com 3 ou mais, as recomendações ficam confiáveis. Importe os arquivos do LinkedIn dos seus posts recentes.`,
      },
    ];
  }

  const out: Insight[] = [];

  // Formato
  if (stats.byFormat.length >= 2) {
    const best = stats.byFormat[0];
    const worst = stats.byFormat[stats.byFormat.length - 1];
    if (best.avg > worst.avg * 1.2) {
      out.push({
        title: `Priorize o formato "${best.key}"`,
        detail: `"${best.key}" engaja ${pct(best.avg)} contra ${pct(worst.avg)} de "${worst.key}". Faça mais ${best.key} e evite ${worst.key}.`,
      });
    }
  }

  // Território
  const terrs = stats.byTerritory.filter((t) => t.key !== "(sem território)");
  if (terrs.length >= 2) {
    const best = terrs[0];
    const worst = terrs[terrs.length - 1];
    out.push({
      title: `Concentre no território "${best.key}"`,
      detail: `Ele engaja ${pct(best.avg)} (${best.n} posts), acima de "${worst.key}" (${pct(worst.avg)}). Dobre a aposta no que funciona e refine o resto.`,
    });
  }
  const semTerr = stats.byTerritory.find((t) => t.key === "(sem território)");
  if (semTerr && semTerr.n >= Math.ceil(stats.n / 2)) {
    out.push({
      title: "Marque os territórios dos seus posts",
      detail: `${semTerr.n} de ${stats.n} posts estão sem território. Classificá-los revela qual tema constrói sua autoridade — e o algoritmo premia coerência.`,
    });
  }

  // Timing
  if (stats.byWeekday.length >= 2) {
    const best = stats.byWeekday[0];
    out.push({
      title: `Seu melhor dia é ${WEEKDAYS[Number(best.key)]}`,
      detail: `Posts de ${WEEKDAYS[Number(best.key)]} engajam ${pct(best.avg)}, acima da sua média (${pct(stats.avgEr)}). Priorize esse dia.`,
    });
  }
  if (stats.byHour.length >= 2) {
    const best = stats.byHour[0];
    out.push({
      title: `Melhor horário: ~${best.key}h`,
      detail: `Publicações por volta de ${best.key}h tiveram o maior engajamento. Padronize seus horários nessa janela.`,
    });
  }

  // Cadência
  if (stats.avgGap != null) {
    if (stats.avgGap > 4) {
      out.push({
        title: "Aumente a cadência",
        detail: `Você posta a cada ~${stats.avgGap.toFixed(0)} dias. O ideal é 3–5x/semana para o algoritmo te manter "quente".`,
      });
    }
    if (stats.daysSince != null && stats.daysSince >= 4) {
      out.push({
        title: "Está na hora de postar",
        detail: `Sua última publicação foi há ${stats.daysSince} dias. Intervalos longos esfriam o alcance.`,
      });
    }
  }

  // Tamanho
  if (Math.abs(stats.lenTop - stats.lenBottom) > 300) {
    const shorter = stats.lenTop < stats.lenBottom;
    out.push({
      title: shorter ? "Posts mais curtos rendem mais" : "Posts mais longos rendem mais",
      detail: `Seus posts de maior engajamento têm ~${stats.lenTop} caracteres; os de menor, ~${stats.lenBottom}. Mire em ~${stats.lenTop}.`,
    });
  }

  // Conversão de perfil
  if (stats.profileViews >= 10 && stats.followers === 0) {
    out.push({
      title: "Gargalo está no perfil, não no conteúdo",
      detail: `Seus posts geraram ${stats.profileViews} visitas ao perfil e 0 seguidores. Otimize headline e seção "Em destaque" para converter quem já chega.`,
    });
  }

  return out;
}

export function buildStrategyContext(
  stats: StrategyStats | null,
  territories: Territory[],
  objectives?: string,
): string {
  if (!stats) return "";
  const lines: string[] = [];
  if (objectives?.trim()) {
    lines.push(`OBJETIVOS DO CRIADOR (priorize recomendações que ajudem a alcançá-los): ${objectives.trim()}`);
    lines.push("");
  }
  lines.push(`Posts medidos: ${stats.n}. Engajamento médio: ${pct(stats.avgEr)}.`);
  lines.push(
    `Por formato: ${stats.byFormat.map((f) => `${f.key} ${pct(f.avg)} (${f.n})`).join("; ")}.`,
  );
  lines.push(
    `Por território: ${stats.byTerritory.map((t) => `${t.key} ${pct(t.avg)} (${t.n})`).join("; ")}.`,
  );
  if (territories.length) {
    lines.push(
      `Territórios definidos: ${territories.map((t) => `${t.name}${t.description ? ` (${t.description})` : ""}`).join("; ")}.`,
    );
  }
  if (stats.byWeekday.length) {
    lines.push(
      `Engajamento por dia: ${stats.byWeekday.map((d) => `${WEEKDAYS[Number(d.key)]} ${pct(d.avg)}`).join("; ")}.`,
    );
  }
  if (stats.byHour.length) {
    lines.push(
      `Engajamento por hora: ${stats.byHour.map((h) => `${h.key}h ${pct(h.avg)}`).join("; ")}.`,
    );
  }
  if (stats.avgGap != null) {
    lines.push(
      `Cadência: ~${stats.avgGap.toFixed(1)} dias entre posts; última publicação há ${stats.daysSince} dias.`,
    );
  }
  lines.push(`Tamanho: melhores ~${stats.lenTop} chars, piores ~${stats.lenBottom} chars.`);
  lines.push(
    `Conversão: ${stats.profileViews} visitas de perfil e ${stats.followers} seguidores ganhos no total.`,
  );
  if (stats.demographics.length) {
    lines.push(
      `Público: ${stats.demographics
        .map((d) => `${d.dimension}: ${d.top.map((t) => `${t.label} ${t.pct.toFixed(0)}%`).join(", ")}`)
        .join(" | ")}.`,
    );
  }
  lines.push("");
  lines.push("Posts de maior engajamento (trechos):");
  stats.topPosts.forEach((p, i) => {
    const excerpt = p.text.length > 400 ? p.text.slice(0, 400) + "…" : p.text;
    lines.push(`#${i + 1} (${pct(p.er)}${p.territory ? `, território: ${p.territory}` : ""}): ${excerpt}`);
  });
  return lines.join("\n");
}
