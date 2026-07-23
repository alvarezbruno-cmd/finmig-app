import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getClient } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 30;

// Modelo dedicado à narração pedagógica do coach de xadrez.
const NARRATE_MODEL = "claude-sonnet-5";

interface NarrateRequest {
  fen: string;
  playedSan: string;
  bestSan: string;
  label: string;
}

// Explica em UMA frase, em português, qual conceito o aluno violou. Se a chave
// da API não estiver configurada, devolve 204 e o cliente cai para a heurística.
export async function POST(req: Request) {
  let body: NarrateRequest;
  try {
    body = (await req.json()) as NarrateRequest;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.fen || !body.bestSan) {
    return NextResponse.json({ error: "fen e bestSan são obrigatórios" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    // Sem chave: sinaliza ao cliente para usar o comentário heurístico local.
    return new NextResponse(null, { status: 204 });
  }

  const prompt =
    "Você é um treinador de xadrez paciente. O aluno acabou de jogar um lance " +
    "sub-ótimo. Explique em UMA única frase, em português simples e sem jargão " +
    "excessivo, QUAL CONCEITO ele violou e por que o lance recomendado é melhor. " +
    "Não repita a avaliação numérica. Seja concreto.\n\n" +
    `Posição (FEN, antes do lance dele): ${body.fen}\n` +
    `Lance que ele jogou: ${body.playedSan}\n` +
    `Melhor lance: ${body.bestSan}\n` +
    `Classificação do erro: ${body.label}\n`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: NARRATE_MODEL,
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    return NextResponse.json({ text });
  } catch {
    // Rede/limite/chave inválida: nunca derrube a sessão de treino.
    return new NextResponse(null, { status: 204 });
  }
}
