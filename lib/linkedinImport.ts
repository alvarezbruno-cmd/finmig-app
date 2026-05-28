import type { PostMetrics } from "./types";

export interface LinkedInImport {
  postedAt?: string;
  link?: string;
  metrics: Partial<PostMetrics>;
  topRole?: string;
  topLocation?: string;
  topIndustry?: string;
}

const MONTHS: Record<string, string> = {
  jan: "01",
  fev: "02",
  mar: "03",
  abr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  set: "09",
  out: "10",
  nov: "11",
  dez: "12",
};

function parsePtDate(value: string): string | undefined {
  const m = value.match(/(\d{1,2})\s+de\s+(\w+)\.?\s+de\s+(\d{4})/i);
  if (!m) return undefined;
  const day = m[1].padStart(2, "0");
  const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (!month) return undefined;
  return `${m[3]}-${month}-${day}`;
}

function toInt(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const digits = value.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export async function parseLinkedInXlsx(buffer: ArrayBuffer): Promise<LinkedInImport> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets["Desempenho"] ?? wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("Não encontrei a aba de desempenho no arquivo.");

  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });

  const map = new Map<string, string>();
  for (const row of rows) {
    if (Array.isArray(row) && row[0] != null && row[1] != null) {
      const key = String(row[0]).trim().toLowerCase();
      // Keep the first occurrence (the file repeats demographic labels for
      // reactions and comments; the reactions block comes first).
      if (!map.has(key)) map.set(key, String(row[1]).trim());
    }
  }

  const get = (label: string) => map.get(label.toLowerCase());

  const metrics: Partial<PostMetrics> = {};
  const assign = (label: string, key: keyof PostMetrics) => {
    const n = toInt(get(label));
    if (n != null) metrics[key] = n;
  };
  assign("impressões", "impressions");
  assign("usuários alcançados", "reached");
  assign("visualizações do perfil a partir desta publicação", "profileViews");
  assign("seguidores obtidos com esta publicação", "followers");
  assign("reações", "reactions");
  assign("comentários", "comments");
  assign("compartilhamentos", "shares");
  assign("salvamentos", "saves");
  assign("envios no linkedin", "sends");

  const dateRaw = get("data da publicação");

  if (Object.keys(metrics).length === 0) {
    throw new Error("Não encontrei métricas nesse arquivo. É o export de uma publicação do LinkedIn?");
  }

  return {
    postedAt: dateRaw ? parsePtDate(dateRaw) : undefined,
    link: get("url da publicação"),
    metrics,
    topRole: get("principal cargo"),
    topLocation: get("principal localidade"),
    topIndustry: get("principal setor"),
  };
}
