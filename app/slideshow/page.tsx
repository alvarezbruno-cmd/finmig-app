"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface PhotoMeta {
  file: File;
  objectUrl: string;
  name: string;
  year: string | null;
  city: string | null;
  country: string | null;
  caption: string;
}

type Step = "upload" | "processing" | "review" | "player";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function stripExt(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

function buildCaption(
  year: string | null,
  city: string | null,
  country: string | null,
): string {
  const parts: string[] = [];
  if (year) parts.push(`[${year}]`);
  const loc = [city, country].filter(Boolean).join(" - ");
  if (loc) parts.push(loc);
  return parts.join(" ");
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const KB_ANIMATIONS = [
  "kenburns-zoom-in",
  "kenburns-zoom-out",
  "kenburns-pan-left",
  "kenburns-pan-right",
  "kenburns-diag-1",
  "kenburns-diag-2",
] as const;

const BATCH_SIZE = 50;
const REVIEW_PER_PAGE = 48;

/* ─── Player ─────────────────────────────────────────────────────────────── */

interface PlayerProps {
  photos: PhotoMeta[];
  initialOrder: number[];
  onExit: () => void;
}

function Player({ photos, initialOrder, onExit }: PlayerProps) {
  const [order, setOrder] = useState(initialOrder);
  const [pos, setPos] = useState(0);
  const [visible, setVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showCaption, setShowCaption] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [speed, setSpeed] = useState(6);
  const [isShuffle, setIsShuffle] = useState(initialOrder !== initialOrder); // false
  const [clock, setClock] = useState(() => new Date());
  const [imgKey, setImgKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef(speed);
  const isPlayingRef = useRef(isPlaying);
  const orderRef = useRef(order);
  const posRef = useRef(pos);

  speedRef.current = speed;
  isPlayingRef.current = isPlaying;
  orderRef.current = order;
  posRef.current = pos;

  const photo = photos[order[pos]];
  const kbAnim = KB_ANIMATIONS[order[pos] % KB_ANIMATIONS.length];

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Advance to next/prev with fade
  const advance = useCallback(
    (dir: 1 | -1) => {
      setVisible(false);
      setTimeout(() => {
        setPos((p) => {
          const len = orderRef.current.length;
          return (p + dir + len) % len;
        });
        setImgKey((k) => k + 1);
        setVisible(true);
      }, 600);
    },
    [],
  );

  // Auto-play
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      advance(1);
    }, speedRef.current * 1000);
  }, [advance]);

  useEffect(() => {
    if (isPlaying) {
      startTimer();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, startTimer, speed]);

  // Keyboard navigation
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          advance(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          advance(-1);
          break;
        case " ":
          e.preventDefault();
          setIsPlaying((p) => !p);
          break;
        case "c":
        case "C":
          setShowCaption((c) => !c);
          break;
        case "s":
        case "S":
          setIsShuffle((s) => {
            const next = !s;
            setOrder(next ? shuffleArray(initialOrder) : [...initialOrder]);
            setPos(0);
            return next;
          });
          break;
        case "f":
        case "F":
          if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
          break;
        case "Escape":
          if (!document.fullscreenElement) onExit();
          break;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [advance, initialOrder, onExit]);

  // Auto-hide controls
  function revealControls() {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3500);
  }

  function toggleShuffle() {
    setIsShuffle((s) => {
      const next = !s;
      setOrder(next ? shuffleArray(initialOrder) : [...initialOrder]);
      setPos(0);
      return next;
    });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black z-50 overflow-hidden select-none"
      style={{ cursor: showControls ? "default" : "none" }}
      onMouseMove={revealControls}
      onClick={revealControls}
    >
      {/* Photo with Ken Burns */}
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={imgKey}
          src={photo.objectUrl}
          alt={photo.caption}
          className="absolute inset-0 w-full h-full object-contain"
          style={{
            opacity: visible ? 1 : 0,
            transition: "opacity 0.65s ease-in-out",
            animation: `${kbAnim} ${speed + 3}s ease-in-out both`,
            transformOrigin: "center center",
          }}
        />
      )}

      {/* Caption gradient + text */}
      {showCaption && photo?.caption && (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
            padding: "72px 8% 36px",
            opacity: visible ? 1 : 0,
            transition: "opacity 0.65s ease-in-out",
          }}
        >
          <p
            className="text-white text-center font-light tracking-[0.2em]"
            style={{
              fontSize: "clamp(1.4rem, 2.8vw, 3rem)",
              textShadow: "0 2px 12px rgba(0,0,0,0.9)",
              letterSpacing: "0.18em",
            }}
          >
            {photo.caption}
          </p>
        </div>
      )}

      {/* Top-right clock */}
      <div
        className="absolute top-7 right-9 text-white/35 font-mono tracking-widest pointer-events-none"
        style={{ fontSize: "clamp(0.9rem, 1.8vw, 1.6rem)" }}
      >
        {clock.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>

      {/* Top-left counter */}
      <div
        className="absolute top-7 left-9 text-white/25 pointer-events-none"
        style={{ fontSize: "clamp(0.75rem, 1.4vw, 1.1rem)" }}
      >
        {pos + 1} / {order.length}
      </div>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10 pointer-events-none">
        <div
          className="h-full bg-white/45 transition-all duration-500"
          style={{ width: `${((pos + 1) / order.length) * 100}%` }}
        />
      </div>

      {/* Controls overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 py-6"
        style={{
          opacity: showControls ? 1 : 0,
          transition: "opacity 0.35s ease",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
          paddingBottom: "2rem",
        }}
      >
        {/* Prev */}
        <Ctrl onClick={(e) => { e.stopPropagation(); advance(-1); }} title="Anterior (←)" large>
          ‹
        </Ctrl>

        {/* Play/pause */}
        <Ctrl
          onClick={(e) => { e.stopPropagation(); setIsPlaying((p) => !p); }}
          title="Pausar / Continuar (Espaço)"
        >
          {isPlaying ? "⏸" : "▶"}
        </Ctrl>

        {/* Next */}
        <Ctrl onClick={(e) => { e.stopPropagation(); advance(1); }} title="Próxima (→)" large>
          ›
        </Ctrl>

        <Divider />

        {/* Caption toggle */}
        <Ctrl
          onClick={(e) => { e.stopPropagation(); setShowCaption((c) => !c); }}
          title="Legenda (C)"
          dim={!showCaption}
        >
          𝗧
        </Ctrl>

        {/* Shuffle */}
        <Ctrl
          onClick={(e) => { e.stopPropagation(); toggleShuffle(); }}
          title="Aleatório (S)"
          dim={!isShuffle}
        >
          ⇄
        </Ctrl>

        {/* Speed slider */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-white/50 text-xs">⏱</span>
          <input
            type="range"
            min={3}
            max={30}
            step={1}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-24 accent-white"
          />
          <span className="text-white/55 text-xs w-7 text-right">{speed}s</span>
        </div>

        <Divider />

        {/* Fullscreen */}
        <Ctrl onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} title="Tela cheia (F)">
          ⛶
        </Ctrl>

        {/* Exit */}
        <Ctrl
          onClick={(e) => { e.stopPropagation(); onExit(); }}
          title="Sair (Esc)"
          danger
        >
          ✕
        </Ctrl>
      </div>
    </div>
  );
}

/* ─── Small control button ───────────────────────────────────────────────── */

function Ctrl({
  children,
  onClick,
  title,
  large,
  dim,
  danger,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title?: string;
  large?: boolean;
  dim?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        "rounded-xl bg-black/50 backdrop-blur-sm transition-all hover:bg-black/70",
        large ? "text-4xl px-4 py-1.5" : "text-xl px-4 py-2",
        dim ? "text-white/35 hover:text-white/70" : "",
        danger ? "text-white/50 hover:text-red-400" : "text-white/80 hover:text-white",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-7 bg-white/20 mx-1" />;
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

export default function SlideshowPage() {
  const [step, setStep] = useState<Step>("upload");
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [progress, setProgress] = useState({
    done: 0,
    total: 0,
    batch: 0,
    totalBatches: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [reviewPage, setReviewPage] = useState(0);
  const [playerOrder, setPlayerOrder] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Set webkitdirectory on the folder input (non-standard attribute)
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
    }
  }, []);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.objectUrl));
    };
  }, [photos]);

  /* ── File ingestion ───────────────────────────────────────────────────── */

  function handleFiles(files: File[]) {
    const imageFiles = files
      .filter((f) => f.type.startsWith("image/"))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (imageFiles.length === 0) {
      setError("Nenhuma imagem encontrada nos arquivos selecionados.");
      return;
    }

    const metaList: PhotoMeta[] = imageFiles.map((f) => ({
      file: f,
      objectUrl: URL.createObjectURL(f),
      name: stripExt(f.name),
      year: null,
      city: null,
      country: null,
      caption: "",
    }));

    setPhotos(metaList);
    setError(null);
    processFilenames(metaList);
  }

  async function processFilenames(metaList: PhotoMeta[]) {
    setStep("processing");

    const batches: PhotoMeta[][] = [];
    for (let i = 0; i < metaList.length; i += BATCH_SIZE) {
      batches.push(metaList.slice(i, i + BATCH_SIZE));
    }

    setProgress({ done: 0, total: metaList.length, batch: 0, totalBatches: batches.length });

    const results = [...metaList];

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];
      const filenames = batch.map((p) => p.name);

      try {
        const res = await fetch("/api/slideshow/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filenames }),
        });
        const data = await res.json();

        if (Array.isArray(data.results)) {
          for (const r of data.results as {
            i: number;
            year: string | null;
            city: string | null;
            country: string | null;
          }[]) {
            const globalIdx = bi * BATCH_SIZE + r.i;
            if (globalIdx < results.length) {
              results[globalIdx] = {
                ...results[globalIdx],
                year: r.year,
                city: r.city,
                country: r.country,
                caption: buildCaption(r.year, r.city, r.country),
              };
            }
          }
        }
      } catch {
        // Batch failed — captions stay empty, user can fill manually
      }

      setProgress({
        done: Math.min((bi + 1) * BATCH_SIZE, metaList.length),
        total: metaList.length,
        batch: bi + 1,
        totalBatches: batches.length,
      });

      // Small pause between batches to avoid rate limiting
      if (bi < batches.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    setPhotos(results);
    setStep("review");
  }

  /* ── Drag & drop ──────────────────────────────────────────────────────── */

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Review helpers ───────────────────────────────────────────────────── */

  function updateCaption(idx: number, caption: string) {
    setPhotos((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], caption };
      return next;
    });
  }

  function startPlayer(shuffle: boolean) {
    const seq = Array.from({ length: photos.length }, (_, i) => i);
    setPlayerOrder(shuffle ? shuffleArray(seq) : seq);
    setStep("player");
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  if (step === "player") {
    return (
      <Player
        photos={photos}
        initialOrder={playerOrder}
        onExit={() => setStep("review")}
      />
    );
  }

  const parsedCount = photos.filter((p) => p.caption).length;
  const reviewTotal = Math.ceil(photos.length / REVIEW_PER_PAGE);
  const reviewSlice = photos.slice(
    reviewPage * REVIEW_PER_PAGE,
    (reviewPage + 1) * REVIEW_PER_PAGE,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Slideshow de fotos</h1>
        <p className="mt-1 text-sm text-[var(--color-text-dim)]">
          Selecione uma pasta — a IA lê os nomes dos arquivos e gera legendas{" "}
          <span className="font-mono">[ano] Cidade - País</span> automaticamente.
        </p>
      </header>

      {/* ── Upload ── */}
      {step === "upload" && (
        <div className="space-y-6">
          {error && (
            <p className="text-sm text-[var(--color-danger)] bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <div
            className={[
              "border-2 border-dashed rounded-2xl p-16 text-center transition-colors",
              isDragging
                ? "border-[var(--color-accent)] bg-[var(--color-surface-2)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)]",
            ].join(" ")}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            <div className="text-5xl mb-4">📷</div>
            <p className="text-lg font-medium">Arraste as fotos aqui</p>
            <p className="mt-1 text-sm text-[var(--color-text-dim)]">
              ou escolha uma pasta inteira de uma vez
            </p>

            <div className="mt-7 flex justify-center gap-3">
              <button
                onClick={() => folderInputRef.current?.click()}
                className="px-5 py-2.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-on-accent)] text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                Selecionar pasta
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors"
              >
                Selecionar fotos
              </button>
            </div>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={folderInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleFiles(Array.from(e.target.files ?? []))
            }
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              handleFiles(Array.from(e.target.files ?? []))
            }
          />

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: "🤖",
                title: "IA extrai as legendas",
                desc: 'Claude analisa os nomes dos arquivos e identifica ano, cidade e país — mesmo nomes bagunçados como "paris_2019_ferias_01.jpg".',
              },
              {
                icon: "📺",
                title: "Feito para TV",
                desc: "Tela cheia, fonte grande, efeito Ken Burns, fade entre fotos, relógio no canto. Controles por seta do controle remoto.",
              },
              {
                icon: "✏️",
                title: "Revisão antes de exibir",
                desc: "Confira e edite qualquer legenda antes de iniciar. Fotos sem legenda ficam marcadas para você preencher.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
              >
                <div className="text-2xl mb-2">{f.icon}</div>
                <h3 className="font-medium text-sm">{f.title}</h3>
                <p className="text-xs text-[var(--color-text-dim)] mt-1 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Keyboard shortcuts reference */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h3 className="font-medium text-sm mb-3">
              Atalhos durante o slideshow
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[var(--color-text-dim)]">
              {[
                ["← →", "Foto anterior / próxima"],
                ["Espaço", "Pausar / continuar"],
                ["C", "Mostrar / ocultar legenda"],
                ["S", "Modo aleatório"],
                ["F", "Tela cheia"],
                ["Esc", "Sair do slideshow"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-start gap-2">
                  <kbd className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[0.7rem] font-mono shrink-0">
                    {key}
                  </kbd>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Processing ── */}
      {step === "processing" && (
        <div className="flex flex-col items-center justify-center min-h-72 space-y-6">
          <div
            className="text-5xl"
            style={{ animation: "spin 1.5s linear infinite" }}
          >
            ⚙️
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">Processando legendas com IA…</p>
            <p className="mt-1 text-sm text-[var(--color-text-dim)]">
              Lote {progress.batch} de {progress.totalBatches} &mdash;{" "}
              {progress.done} / {progress.total} fotos
            </p>
          </div>
          <div className="w-full max-w-sm">
            <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500"
                style={{
                  width: `${
                    progress.total
                      ? (progress.done / progress.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-dim)]">
            Para muitas fotos isso pode levar alguns minutos.
          </p>
        </div>
      )}

      {/* ── Review ── */}
      {step === "review" && (
        <div className="space-y-4">
          {/* Stats + actions */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-[var(--color-text-dim)]">
              <span className="text-[var(--color-ok)] font-semibold">
                {parsedCount}
              </span>{" "}
              com legenda &middot;{" "}
              <span
                className={
                  photos.length - parsedCount > 0
                    ? "text-[var(--color-warn)] font-semibold"
                    : ""
                }
              >
                {photos.length - parsedCount}
              </span>{" "}
              sem legenda &middot; {photos.length} fotos
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => startPlayer(false)}
                className="px-5 py-2.5 rounded-lg bg-[var(--color-accent)] text-[var(--color-on-accent)] text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                ▶ Iniciar slideshow
              </button>
              <button
                onClick={() => startPlayer(true)}
                className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors"
              >
                ⇄ Aleatório
              </button>
              <button
                onClick={() => {
                  photos.forEach((p) => URL.revokeObjectURL(p.objectUrl));
                  setPhotos([]);
                  setStep("upload");
                }}
                className="px-5 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium hover:bg-[var(--color-surface-2)] transition-colors"
              >
                ← Nova seleção
              </button>
            </div>
          </div>

          {/* Photo grid with editable captions */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {reviewSlice.map((photo, i) => {
              const globalIdx = reviewPage * REVIEW_PER_PAGE + i;
              return (
                <div key={globalIdx} className="space-y-1">
                  <div className="aspect-square rounded-lg overflow-hidden bg-[var(--color-border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.objectUrl}
                      alt={photo.caption || photo.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <input
                    type="text"
                    value={photo.caption}
                    onChange={(e) => updateCaption(globalIdx, e.target.value)}
                    placeholder="sem legenda"
                    className="w-full text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-dim)]/50 focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {reviewTotal > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                disabled={reviewPage === 0}
                onClick={() => setReviewPage((p) => p - 1)}
                className="px-3 py-1.5 rounded border border-[var(--color-border)] text-sm disabled:opacity-40 hover:bg-[var(--color-surface-2)] transition-colors"
              >
                ←
              </button>
              <span className="text-sm text-[var(--color-text-dim)]">
                Página {reviewPage + 1} de {reviewTotal}
              </span>
              <button
                disabled={reviewPage === reviewTotal - 1}
                onClick={() => setReviewPage((p) => p + 1)}
                className="px-3 py-1.5 rounded border border-[var(--color-border)] text-sm disabled:opacity-40 hover:bg-[var(--color-surface-2)] transition-colors"
              >
                →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
