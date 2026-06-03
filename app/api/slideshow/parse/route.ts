import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const { filenames } = (await req.json()) as { filenames: string[] };

  if (!Array.isArray(filenames) || filenames.length === 0) {
    return NextResponse.json({ error: "No filenames provided" }, { status: 400 });
  }

  const client = getClient();

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: `You extract photo metadata from filenames. Return ONLY a valid JSON array, no explanation.
Rules:
- year: 4-digit year string (1900–2030), null if absent or ambiguous
- city: city name in its common/original form, null if not found
- country: country name in Portuguese (França, Itália, Espanha, Brasil, Estados Unidos, Portugal, Argentina, Japão, etc.), null if not found
- Ignore: IMG_, DSC_, DSCN_, P_, numeric camera sequences, file extensions
- Common patterns you'll see: "2019_Paris_France", "Paris-France-2019", "IMG_20190715_001", "paris franca 2019", "19_Paris"`,
    messages: [
      {
        role: "user",
        content: `Extract year, city, country from these ${filenames.length} photo filenames (index:name):\n${filenames.map((f, i) => `${i}:${f}`).join("\n")}\n\nReturn JSON array: [{"i":0,"year":"2019","city":"Paris","country":"França"},{"i":1,"year":null,"city":null,"country":null},...]\nUse null for unknown fields.`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "[]";

  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("no JSON array in response");
    const results = JSON.parse(match[0]) as Array<{
      i: number;
      year: string | null;
      city: string | null;
      country: string | null;
    }>;
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse Claude response", raw: text },
      { status: 500 },
    );
  }
}
