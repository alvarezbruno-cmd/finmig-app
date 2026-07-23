// Wrapper do Stockfish 18 (WASM lite-single) rodando como Web Worker no navegador.
//
// Usamos a variante "single" (sem threads) de propósito: ela dispensa os
// cabeçalhos de isolamento cross-origin (COOP/COEP) que costumam quebrar WASM no
// Safari do celular. Um único worker cumpre os dois papéis do desenho — analista
// de força total e adversário de Elo limitado — alternando as opções por tarefa.
//
// Só funciona no cliente (usa Worker). Nunca importe isto em código de servidor.

export interface Analysis {
  bestMove: string; // UCI, ex. "e2e4"
  // Avaliação em centipawns do ponto de vista de quem está para jogar.
  // Mate é mapeado para um valor grande e finito para a aritmética do coach.
  scoreCp: number;
  mateIn: number | null;
}

const WASM_URL = "/stockfish/stockfish-18-lite-single.js";
const MATE_SCORE = 100_000;

export class ChessEngine {
  private worker: Worker | null = null;
  private ready = false;
  private queue: Array<(line: string) => void> = [];

  async init(): Promise<void> {
    if (this.ready) return;
    this.worker = new Worker(WASM_URL);
    this.worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : "";
      for (const listener of this.queue) listener(line);
    };
    await this.send("uci", (l) => l === "uciok");
    await this.send("isready", (l) => l === "readyok");
    this.ready = true;
  }

  // Envia um comando e resolve quando `done(line)` retorna true para alguma
  // linha de saída do motor. Coleta todas as linhas até lá.
  private send(
    cmd: string,
    done: (line: string) => boolean,
  ): Promise<string[]> {
    return new Promise((resolve) => {
      const lines: string[] = [];
      const listener = (line: string) => {
        lines.push(line);
        if (done(line)) {
          this.queue = this.queue.filter((l) => l !== listener);
          resolve(lines);
        }
      };
      this.queue.push(listener);
      this.worker!.postMessage(cmd);
    });
  }

  private post(cmd: string): void {
    this.worker!.postMessage(cmd);
  }

  private async setStrength(elo: number | null): Promise<void> {
    if (elo === null) {
      this.post("setoption name UCI_LimitStrength value false");
    } else {
      const clamped = Math.max(1320, Math.min(3190, elo));
      this.post("setoption name UCI_LimitStrength value true");
      this.post(`setoption name UCI_Elo value ${clamped}`);
    }
    await this.send("isready", (l) => l === "readyok");
  }

  // Análise de força total: melhor lance + avaliação. Usada para julgar você.
  async analyse(fen: string, depth = 12): Promise<Analysis> {
    await this.setStrength(null);
    this.post(`position fen ${fen}`);
    let scoreCp = 0;
    let mateIn: number | null = null;
    const lines = await this.send(`go depth ${depth}`, (l) =>
      l.startsWith("bestmove"),
    );
    // A última linha "info ... score ..." antes do bestmove é a definitiva.
    for (const line of lines) {
      if (!line.startsWith("info")) continue;
      const mMate = line.match(/score mate (-?\d+)/);
      const mCp = line.match(/score cp (-?\d+)/);
      if (mMate) {
        mateIn = parseInt(mMate[1], 10);
        scoreCp = mateIn > 0 ? MATE_SCORE - mateIn : -MATE_SCORE - mateIn;
      } else if (mCp) {
        scoreCp = parseInt(mCp[1], 10);
        mateIn = null;
      }
    }
    const best = lines[lines.length - 1].match(/bestmove (\S+)/);
    return {
      bestMove: best ? best[1] : "",
      scoreCp,
      mateIn,
    };
  }

  // Lance do adversário com força limitada por Elo (sparring realista).
  async playAtElo(fen: string, elo: number, movetimeMs = 200): Promise<string> {
    await this.setStrength(elo);
    this.post(`position fen ${fen}`);
    const lines = await this.send(`go movetime ${movetimeMs}`, (l) =>
      l.startsWith("bestmove"),
    );
    const best = lines[lines.length - 1].match(/bestmove (\S+)/);
    return best ? best[1] : "";
  }

  dispose(): void {
    if (this.worker) {
      try {
        this.worker.postMessage("quit");
        this.worker.terminate();
      } catch {
        /* noop */
      }
      this.worker = null;
      this.ready = false;
    }
  }
}

export { MATE_SCORE };
