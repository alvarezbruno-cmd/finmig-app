import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/claude";
import { buildSystemBlocks, buildUserMessage, parseVariations } from "@/lib/prompts";
import type { GenerateRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.topic?.trim()) {
    return NextResponse.json({ error: "Tópico é obrigatório" }, { status: 400 });
  }

  const ideas = (body.ideas ?? []).filter((i) => i.text?.trim().length > 0);
  if (ideas.length === 0 && !body.extraNotes?.trim()) {
    return NextResponse.json(
      { error: "Selecione ao menos uma ideia central (ou escreva notas adicionais)." },
      { status: 400 },
    );
  }

  const refs = (body.references ?? []).filter((r) => r.trim().length > 0);

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.9,
      system: buildSystemBlocks(refs),
      messages: [
        {
          role: "user",
          content: buildUserMessage(
            body.topic,
            ideas,
            body.extraNotes,
            body.performance,
            body.territory,
            body.objectives,
          ),
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const variations = parseVariations(text);

    if (variations.length === 0) {
      return NextResponse.json(
        { error: "A IA retornou um formato inesperado." },
        { status: 502 },
      );
    }

    return NextResponse.json({ variations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
