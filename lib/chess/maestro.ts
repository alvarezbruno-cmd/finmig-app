// O maestro: escolhe o foco da próxima sessão a partir do seu histórico de
// erros. Porta de chess-coach/chess_coach/maestro.py.

import { seedForTheme, type Seed } from "./curriculum";
import { themeCounts, type Theme } from "./srs";

export interface Focus {
  theme: Theme;
  reason: string;
  seed: Seed;
}

const DEFAULT_PRIORITY: Theme[] = ["tatica", "meio-jogo", "abertura", "final"];

export function chooseFocus(): Focus {
  const counts = themeCounts();
  const entries = Object.entries(counts);

  if (entries.length === 0) {
    const theme = DEFAULT_PRIORITY[0];
    return {
      theme,
      reason:
        "Sem histórico ainda — começamos por táticas, onde está o maior retorno de aprendizado.",
      seed: seedForTheme(theme),
    };
  }

  const [theme, n] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return {
    theme: theme as Theme,
    reason: `Você acumulou ${n} erro(s) em '${theme}' — é onde vamos focar.`,
    seed: seedForTheme(theme as Theme),
  };
}
