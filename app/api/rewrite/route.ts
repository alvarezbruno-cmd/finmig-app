import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { extractJSON, getClient, MODEL } from "@/lib/claude";
import { buildRewriteMessage, REWRITE_SYSTEM } from "@/lib/prompts";
import type { RewriteRequest, RewriteResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: RewriteRequest;
  try {
    body = (await req.json()) as RewriteRequest;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.snippet?.trim() || !body.instruction?.trim()) {
    return NextResponse.json(
      { error: "Trecho e instrução são obrigatórios" },
      { status: 400 },
    );
  }

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.7,
      system: [
        { type: "text", text: REWRITE_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: buildRewriteMessage(body.fullPost, body.snippet, body.instruction),
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const parsed = extractJSON<RewriteResponse>(text);
    if (!parsed.rewritten) {
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
