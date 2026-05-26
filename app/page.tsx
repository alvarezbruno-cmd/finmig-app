import { Generator } from "@/components/Generator";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Gerar post</h1>
        <p className="mt-1 text-sm text-[var(--color-text-dim)]">
          Tópico + ideias centrais selecionadas + referências de estilo → 3 variações que
          costuram suas ideias na sua voz.
        </p>
      </header>
      <Generator />
    </div>
  );
}
