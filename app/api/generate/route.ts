import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { extractJSON, getClient, MODEL } from "@/lib/claude";
import { buildSystemBlocks, buildUserMessage } from "@/lib/prompts";
import type { GenerateRequest, GenerateResponse } from "@/lib/types";

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

  const refs = (body.references ?? []).filter((r) => r.trim().length > 0);

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.9,
      system: buildSystemBlocks(refs),
      messages: [
        { role: "user", content: buildUserMessage(body.topic, body.sourceContent ?? "") },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const parsed = extractJSON<GenerateResponse>(text);

    if (!parsed.variations || !Array.isArray(parsed.variations)) {
      return NextResponse.json(
        { error: "A IA retornou um formato inesperado." },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
