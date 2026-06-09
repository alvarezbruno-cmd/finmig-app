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
  "porque, no fundo",
  "e isso muda tudo",
  "talvez o verdadeiro problema seja",
  "mais do que nunca",
  "e aqui está o ponto",
  "a pergunta que fica é",
  "o paradoxo é que",
  "sofisticação silenciosa",
  "elegantemente contraditório",
  "a resposta não é simples",
  "diferença brutal",
  "no fundo, é isso que sustenta",
  "não é sobre",
];

export interface ValidationIssue {
  type: "cliche" | "length" | "hashtags" | "emojis" | "linebreaks" | "ai-tell";
  severity: "error" | "warning";
  message: string;
  match?: string;
}

const MAX_CHARS = 3000;
const IDEAL_MIN = 500;
const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/gu;

// Marcas de IA e clichês — independem de plataforma (servem para posts e artigos).
export function detectAiTells(text: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lower = text.toLowerCase();

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

  const dashes = text.match(/—|–|\s-\s/g) ?? [];
  if (dashes.length > 0) {
    issues.push({
      type: "ai-tell",
      severity: "warning",
      message: `${dashes.length} travessão(ões). É marca de IA — troque por vírgula, ponto ou parênteses.`,
    });
  }

  const antithesis =
    /\bnão (?:é|se trata de|são) [^.!?:;]{1,160}[.!?:;]\s*(?:e sim |mas )?(?:é|são)[\s,]/i.test(text) ||
    /\bo problema não é [^.!?:;]{1,120}[,.:;]\s*(?:e sim |é )/i.test(text) ||
    /\bmais do que [^.!?:;]{1,80},?\s*(?:é |trata-se)/i.test(text);
  if (antithesis) {
    issues.push({
      type: "ai-tell",
      severity: "warning",
      message: 'Construção "Não é X. É Y." detectada — afirme de forma direta.',
    });
  }

  const withholding =
    /\bo que (?:poucos|muitos|ninguém|ainda não)\b[^.!?]{0,80}(?:percebe|ficou claro|sabe|discute|nota)/i.test(text) ||
    /\b(?:a verdade|o ponto|o detalhe|o problema) (?:incômod[ao]|que ninguém|que pouca gente)\b/i.test(text) ||
    /\bo preço que se paga\b/i.test(text);
  if (withholding) {
    issues.push({
      type: "ai-tell",
      severity: "warning",
      message: "Construção de suspense (valor retido) detectada — diga direto, sem teaser.",
    });
  }

  return issues;
}

export function validatePost(post: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [...detectAiTells(post)];

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
