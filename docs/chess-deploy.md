# Coach de Xadrez — como ter o link e o salvamento entre dispositivos

O objetivo: uma URL limpa que você abre no celular e no computador, com o
progresso (erros + repetição espaçada) **salvo na sua conta**, sincronizando
entre os aparelhos. Isso exige duas coisas que rodam na **sua** conta — eu não
consigo fazê-las por você, mas são um passo único.

## Por que precisa de login

O salvamento entre dispositivos só é possível se o progresso ficar amarrado a uma
conta sua (não ao navegador). Por isso o `/chess` fica atrás do mesmo login
(Supabase) do resto do app: você entra uma vez em cada aparelho com o mesmo
email/senha e o avanço aparece nos dois.

## Passo a passo (uma vez)

### 1. Supabase (a conta + o banco)
1. Crie um projeto em https://supabase.com (grátis).
2. Em **SQL Editor**, cole e rode o conteúdo de [`supabase/chess_cards.sql`](../supabase/chess_cards.sql).
   Isso cria a tabela do progresso com segurança por usuário (RLS).
3. Em **Project Settings → API**, copie:
   - `Project URL`  → vira `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public`  → vira `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Em **Authentication → Providers → Email**, deixe o login por email/senha
   ligado. (Se quiser entrar sem confirmar email, desligue "Confirm email".)

### 2. Vercel (a URL limpa)
1. Em https://vercel.com, **Add New → Project** e importe o repositório
   `alvarezbruno-cmd/finmig-app`.
2. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = (o Project URL do passo 1)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (a anon key do passo 1)
   - `ANTHROPIC_API_KEY` = (opcional — habilita a explicação rica do Claude;
     sem ela, o coach usa o comentário heurístico local)
3. **Deploy.** Ao terminar, sua URL é algo como
   `https://finmig-app-xxxx.vercel.app` — e o coach fica em **`/chess`**:
   `https://finmig-app-xxxx.vercel.app/chess`

### 3. Usar
- Abra a URL no celular, crie a conta (email/senha) e jogue.
- Abra a mesma URL no computador, entre com o mesmo email/senha — seu progresso
  já estará lá. É só clicar e continuar.

## Observações
- **Branch:** o código está na branch `claude/chess-teaching-machine-y0267h`. Na
  Vercel você pode apontar o deploy para essa branch, ou fazer merge para a branch
  principal antes de publicar.
- **Custo:** tudo aqui tem plano gratuito suficiente para uso pessoal. O motor
  (Stockfish) roda no seu navegador, sem custo de servidor.
