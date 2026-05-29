import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `Você é um estrategista sênior de LinkedIn, especialista no algoritmo atual (distribuição por compreensão semântica, que premia coerência temática, profundidade e penaliza conteúdo genérico de IA).

Você recebe os dados REAIS de desempenho de um criador. Escreva um briefing estratégico acionável para as próximas 4 semanas, em português brasileiro.

Regras:
- Baseie-se SOMENTE nos números fornecidos. Não invente dados.
- Seja específico e priorize por impacto: comece pelo que mais move o ponteiro.
- Cada recomendação deve ter o "porquê" (o número que a sustenta) e o "como" (ação concreta).
- Conecte os pontos (ex: território que engaja + melhor dia + formato vencedor = um plano de publicação).
- Seja direto e honesto. Se os dados são poucos, diga e recomende o que medir.
- Não use travessões nem a construção "Não é X. É Y.". Texto limpo, em tópicos curtos.
- No máximo ~400 palavras.`;

export async function POST(req: Request) {
  let body: { context?: string };
  try {
    body = (await req.json()) as { context?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.context?.trim()) {
    return NextResponse.json({ error: "Sem dados para analisar." }, { status: 400 });
  }

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.6,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Dados de desempenho do criador:\n\n${body.context}\n\nEscreva o briefing estratégico.`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "Resposta vazia." }, { status: 502 });
    }
    return NextResponse.json({ briefing: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
