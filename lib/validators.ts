export const BANNED_PHRASES = [
  "em um mundo onde",
  "num mundo onde",
  "recentemente, tive a oportunidade",
  "tive a oportunidade de",
  "é com grande satisfação",
  "é com imenso orgulho",
  "estou muito feliz em compartilhar",
  "estou orgulhoso em compartilhar",
  "feliz em anunciar",
  "tenho o prazer de anunciar",
  "acabou de sair do forno",
  "bora juntos",
  "vamos juntos",
  "game changer",
  "game-changer",
  "disruptivo",
  "transformacional",
  "mudou minha vida",
  "mudou a minha vida",
  "nem todo mundo sabe disso",
  "você precisa entender isso",
  "você precisa saber disso",
  "o segredo que ninguém te conta",
  "o que ninguém te conta",
  "vou te contar um segredo",
  "antes que você role",
  "para ou lê",
  "para tudo e lê",
  "spoiler:",
  "plot twist",
  "mindset vencedor",
  "mindset de campeão",
  "insights valiosos",
  "agregar valor",
  "tirar o chapéu",
  "deixar minha humilde opinião",
  "humilde opinião",
];

export interface ValidationIssue {
  type: "cliche" | "length" | "hashtags" | "emojis" | "linebreaks";
  severity: "error" | "warning";
  message: string;
  match?: string;
}

const MAX_CHARS = 3000;
const IDEAL_MIN = 500;
const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/gu;

export function validatePost(post: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lower = post.toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push({
        type: "cliche",
        severity: "error",
        message: `Clichê detectado: "${phrase}"`,
        match: phrase,
      });
    }
  }

  if (post.length > MAX_CHARS) {
    issues.push({
      type: "length",
      severity: "error",
      message: `${post.length} chars — excede o limite do LinkedIn (${MAX_CHARS}).`,
    });
  } else if (post.length < IDEAL_MIN) {
    issues.push({
      type: "length",
      severity: "warning",
      message: `${post.length} chars — bem curto. Confira se a ideia está desenvolvida o suficiente.`,
    });
  }

  const hashtags = post.match(/#\w+/g) ?? [];
  if (hashtags.length > 3) {
    issues.push({
      type: "hashtags",
      severity: "warning",
      message: `${hashtags.length} hashtags. Use no máximo 3 hiper-específicas.`,
    });
  }

  const emojis = post.match(EMOJI_REGEX) ?? [];
  if (emojis.length > 3) {
    issues.push({
      type: "emojis",
      severity: "warning",
      message: `${emojis.length} emojis. LinkedIn performa melhor com 0–2 emojis funcionais.`,
    });
  }

  return issues;
}

export function scorePost(post: string): number {
  const issues = validatePost(post);
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  return Math.max(0, 100 - errors * 25 - warnings * 8);
}
