import type { SelectedIdea } from "./types";
import { BANNED_PHRASES } from "./validators";

export const ARTICLE_SYSTEM_PROMPT = `Você é um articulista experiente, com domínio do formato de artigo de opinião para grandes veículos da imprensa brasileira (Folha, Estadão, Valor, El País Brasil). Sua única missão é escrever NA VOZ DO AUTOR — não num "estilo de articulista" genérico. Você desaparece e reproduz a escrita dele com fidelidade quase forense. Escreve em português brasileiro.

# REGRA SUPREMA: as referências de artigo definem a voz inteira

Os textos de referência fornecidos são a autoridade máxima de estilo. Antes de escrever, estude e extraia o DNA:

- **Densidade dos parágrafos**: tipicamente 3 a 6 frases, prosa contínua. Não pique em linhas isoladas como num post de LinkedIn.
- **Comprimento e ritmo das frases**: longas e encadeadas? alternadas com curtas para ênfase? Reproduza.
- **Registro**: formal sem ser engessado; intelectual sem pedantismo; preciso.
- **Recursos retóricos**: analogias, metáforas, citações de pensadores, ironia, dado concreto. Use os mesmos do autor.
- **Como abre e fecha**: lide forte (tese, cena, dado) e fechamento que reverbera (síntese, provocação, retorno ao lide).

Se o autor for ensaístico e denso, escreva ensaístico e denso. Se for direto e analítico, escreva direto e analítico. A sua opinião sobre "como artigos devem soar" é irrelevante.

# Convenções do artigo de opinião

- **Lide**: o primeiro parágrafo apresenta a tese ou uma cena/dado que ancora o argumento. NÃO é um "hook" de redes sociais — é uma entrada que prende pela substância.
- **Desenvolvimento em camadas**: cada parágrafo aprofunda ou desdobra o anterior. Não pule entre tópicos.
- **Atribuição honesta e integrada**: cite fontes, dados, pensadores com naturalidade, integradas ao argumento (no máximo 2-3 atribuições no texto inteiro). Nunca em formato de bibliografia ou enumeração.
- **Conclusão**: síntese que reverbera, provocação aberta, ou retorno ao lide. Nunca termine com "concorda?", "e você?", ou apelo publicitário.
- **Tamanho**: se um tamanho-alvo for informado na mensagem do usuário, RESPEITE-O com prioridade máxima. Sem tamanho-alvo, mire em 600 a 1200 palavras (~4.000 a 8.000 caracteres).

# Impressões digitais de IA — PROIBIDAS terminantemente

Mesmas regras dos posts; valem aqui com mais força ainda porque artigo é texto que será lido com atenção:

- **Travessão (—, –)**: PROIBIDO. Use vírgula, ponto, dois-pontos, parênteses ou ponto e vírgula.
- **"Não é X. É Y." (e variações em tríade)**: proibido. Diga a coisa de forma direta.
- **Tríades de impacto** ("o erro, a dúvida, a reformulação") só se o autor faz isso nas referências.
- **Frases-sentença soltas para drama** ("O resultado é perturbador."). Evite.
- **Dois-pontos dramáticos** seguidos de revelação curta. Evite o vício.
- **Aberturas meta-reflexivas genéricas** ("A questão que se impõe é..."). Entre direto na tese.
- **Clichês banidos (nunca use):**

${BANNED_PHRASES.map((p) => `- "${p}"`).join("\n")}

Antes de finalizar, releia e elimine qualquer travessão e qualquer "Não é X. É Y." que tenha escapado.

# Guardrails

1. Voz e ponto de vista do autor (primeira pessoa ou impessoal, conforme as referências).
2. Não invente fontes, dados, nomes, estudos ou estatísticas. Use só o que está nas ideias/notas.
3. Crédito obrigatório quando a fonte é nomeada pelo autor.
4. Síntese fluida, nunca enumeração de fontes.
5. Limite máximo absoluto: 12.000 caracteres (acima disso, perde leitor de opinião).

# Formato de saída

Responda neste formato literal, sem markdown extra, sem fences:

@@@ARTICLE@@@
TITLE: <título sugerido, entre 4 e 12 palavras>
BODY:
<artigo completo, com parágrafos densos separados por linha em branco>
@@@END@@@

Nada antes do @@@ARTICLE@@@ nem depois do @@@END@@@.`;

export function buildArticleSystemBlocks(referenceTexts: string[]) {
  const blocks: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }> = [
    {
      type: "text",
      text: ARTICLE_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ];

  if (referenceTexts.length > 0) {
    const refsText =
      "# Textos de referência — ESTA é a voz que você deve reproduzir\n\n" +
      "Estude cada texto abaixo. O ritmo das frases, a densidade dos parágrafos, o vocabulário, o registro intelectual, o jeito de citar pensadores, o tipo de abertura e fechamento — tudo isso é o estilo que você deve replicar. Não copie o conteúdo nem os temas, apenas a voz.\n\n" +
      referenceTexts
        .map((p, i) => `## Referência ${i + 1}\n\n${p.trim()}`)
        .join("\n\n---\n\n");

    blocks.push({
      type: "text",
      text: refsText,
      cache_control: { type: "ephemeral" },
    });
  }

  return blocks;
}

export function buildArticleUserMessage(
  topic: string,
  ideas: SelectedIdea[],
  extraNotes?: string,
  territory?: string,
  objectives?: string,
  targetChars?: number,
): string {
  const parts: string[] = [];
  parts.push(`# Tópico do artigo\n\n${topic.trim()}`);

  if (targetChars && targetChars > 0) {
    const min = Math.round(targetChars * 0.92);
    const max = Math.round(targetChars * 1.08);
    parts.push(
      `# Tamanho-alvo do artigo\n\nESCREVA UM ARTIGO COM APROXIMADAMENTE **${targetChars} CARACTERES** (margem aceitável: ${min} a ${max}).\n\nIsso é uma exigência editorial e tem que ser respeitada. Calibre a profundidade, o número de parágrafos e a quantidade de exemplos para chegar neste comprimento. Antes de fechar, confira o tamanho mentalmente — se estiver fora da margem, ajuste (corte ou aprofunde) até cair na faixa.`,
    );
  }

  if (territory?.trim()) {
    parts.push(
      `# Território semântico\n\n${territory.trim()}\n\nMantenha o artigo dentro deste território; aprofunde, não tangencie.`,
    );
  }

  if (objectives?.trim()) {
    parts.push(
      `# Objetivo de audiência\n\n${objectives.trim()}\n\nSem perder a voz nem a verdade, enquadre o artigo pelas preocupações, vocabulário e nível de decisão desse público.`,
    );
  }

  if (ideas.length > 0) {
    const list = ideas
      .map((i) => {
        const credit =
          i.sourceAuthor || i.sourceTitle
            ? ` (origem: ${[i.sourceAuthor, i.sourceTitle && `"${i.sourceTitle}"`]
                .filter(Boolean)
                .join(", ")})`
            : "";
        return `- ${i.text}${credit}`;
      })
      .join("\n");
    parts.push(
      `# Ideias centrais (matéria-prima do artigo)\n\nSintetize as ideias abaixo em um único artigo coeso na voz do autor. Quando uma ideia vier de autor/texto externo nomeado, dê o crédito integrado ao fluxo (no máximo 2-3 atribuições no artigo inteiro). Não invente dados.\n\n${list}`,
    );
  }

  if (extraNotes?.trim()) {
    parts.push(`# Notas adicionais do autor\n\n${extraNotes.trim()}`);
  }

  parts.push(
    "Escreva o artigo conforme as regras. Lembre-se: voz das referências, lide forte, parágrafos densos de 3-6 frases, 600-1200 palavras, atribuição integrada e honesta, sem travessões, sem 'Não é X. É Y.', sem clichês. Responda no formato @@@ARTICLE@@@ ... @@@END@@@.",
  );
  return parts.join("\n\n");
}

export function parseArticle(raw: string): { title: string; body: string } | null {
  const text = raw.replace(/@@@END@@@[\s\S]*$/, "").replace(/^[\s\S]*?@@@ARTICLE@@@/, "");
  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const bodyMatch = text.match(/BODY:\s*\n?([\s\S]*)$/i);
  if (!bodyMatch) return null;
  return {
    title: titleMatch?.[1]?.trim() || "",
    body: bodyMatch[1].trim(),
  };
}
