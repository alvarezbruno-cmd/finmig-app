-- Tabela do progresso do coach de xadrez (repetição espaçada), por usuário.
-- Cole isto no SQL Editor do seu projeto Supabase e rode uma vez.
-- O RLS garante que cada usuário só enxerga e altera os próprios cards, e por
-- isso o progresso sincroniza com segurança entre celular e computador.

create table if not exists public.chess_cards (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fen           text not null,
  best_san      text not null,
  theme         text not null,
  ease          double precision not null default 2.5,
  interval_days double precision not null default 0,
  reps          integer not null default 0,
  due           timestamptz not null default now(),
  created       timestamptz not null default now(),
  last_note     text,
  primary key (user_id, fen)
);

alter table public.chess_cards enable row level security;

-- Um usuário só pode ler/escrever os próprios cards.
drop policy if exists "chess_cards owner" on public.chess_cards;
create policy "chess_cards owner" on public.chess_cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
