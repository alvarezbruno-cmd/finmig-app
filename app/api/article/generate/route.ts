import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/claude";
import {
  buildArticleSystemBlocks,
  buildArticleUserMessage,
  parseArticle,
} from "@/lib/articlePrompts";
import type { ArticleGenerateRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request) {
  let body: ArticleGenerateRequest;
  try {
    body = (await req.json()) as ArticleGenerateRequest;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.topic?.trim()) {
    return NextResponse.json({ error: "Tópico é obrigatório" }, { status: 400 });
  }

  const ideas = (body.ideas ?? []).filter((i) => i.text?.trim().length > 0);
  if (ideas.length === 0 && !body.extraNotes?.trim()) {
    return NextResponse.json(
      { error: "Selecione ao menos uma ideia (ou escreva notas adicionais)." },
      { status: 400 },
    );
  }

  const refs = (body.references ?? []).filter((r) => r.trim().length > 0);

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      temperature: 0.7,
      system: buildArticleSystemBlocks(refs),
      messages: [
        {
          role: "user",
          content: buildArticleUserMessage(
            body.topic,
            ideas,
            body.extraNotes,
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

    const parsed = parseArticle(text);
    if (!parsed) {
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
