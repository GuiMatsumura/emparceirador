# Commander 150 — guia rápido do projeto

Sistema web para gestão de torneios de **Magic: The Gathering no formato 2v2 com duplas aleatórias**
(nasceu como projeto de extensão da PUC Minas; hoje vive no repo GuiMatsumura/emparceirador). Toda a base (código, comentários, mensagens de
API, commits) é em **português** — mantenha esse padrão.

Análise detalhada (endpoints, fluxos, máquina de estados, backlog de bugs): **[ANALISE_TECNICA.md](ANALISE_TECNICA.md)**.

## Estrutura

```
backend/              Django 5.2 + DRF (Python 3.12 em prod; local tem 3.13)
    core/             settings.py, urls.py, .env (gitignored)
    usuarios/         Usuario custom (email = login, campo tipo JOGADOR|LOJA|ADMIN), auth por sessão
    torneios/         Torneio, Inscricao, Rodada, Mesa, MesaJogador, RankingParcial
      views.py        ~1700 linhas — regra de negócio (iniciar, rodadas, inscrições, resultado)
      emparelhamento.py  critério de jogador ativo + emparelhamento aleatório e Swiss (fonte única)
      ranking_utils.py  cálculo de ranking/desempate (MW%, OMW%, PMW%, Balanço)
      permissoes.py   IsLojaOuAdmin, IsApenasLeitura, IsDonoDoTorneioOuAdmin, IsJogadorNaMesa...
      tests.py        testes de API (usuarios/tests.py idem)
frontend/             React 19 + TypeScript + Vite 7, react-router 7, axios, sweetalert2, CSS modules
    src/services/     api.ts (axios withCredentials), authServico, torneioServico, mesaServico
    src/contextos/AuthContexto.tsx   useSessao() — estado global do usuário logado
    src/routes/       AppRoutes.tsx + RotaSegura.tsx (só checa login, não checa tipo)
    src/pages/Torneio/infoTorneioLoja/index.tsx  ~2160 linhas — painel da LOJA (gestão do torneio)
    src/pages/Mesa/   intervalo + mesa-ativa — visão do JOGADOR durante o torneio
docs/                 documentação técnica (algoritmo de ranking, bye, deploy)
```

## Comandos

Backend (em `backend/`):
```
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000      # Swagger em /swagger/ , Redoc em /redoc/
python manage.py test --settings=core.settings_test   # SQLite em memória, não toca no Postgres
python manage.py check
python manage.py makemigrations --check --dry-run
```
`backend/core/.env` (modelo em `backend/.env.example`) precisa de: `DEBUG, SECRET_KEY, DATABASE_URL (Postgres/Neon), EMAIL_USER, EMAIL_PASSWORD,
CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS, ALLOWED_HOSTS`. O banco vem de `DATABASE_URL` (as vars `DB_*` estão obsoletas).

Frontend (em `frontend/`):
```
npm install
npm run dev        # http://localhost:5173 ; precisa de VITE_API_BASE_URL no .env (ex: http://localhost:8000/api/v1)
npm run build      # tsc -b && vite build
npm run lint       # hoje: ~100 erros pré-existentes (no-explicit-any etc.) — não é regressão nossa
```
Testes: só no backend (41 testes de API). Todo bug corrigido deve ganhar um teste que falha antes da correção.
O frontend não tem framework de teste.

Deploy: backend no Render (gunicorn), banco Neon (Postgres), frontend na Vercel (`vercel.json` com rewrite SPA).

## Conceitos de domínio (essencial)

- **Tipos de usuário**: `JOGADOR` (se inscreve, reporta resultado da própria mesa), `LOJA` (cria/gerencia
  seus torneios), `ADMIN` (tudo).
- **Torneio.status**: `Aberto` → `Em Andamento` → `Finalizado` (ou `Cancelado`, só a partir de Aberto).
  Strings livres (não há choices) — cuidado com grafia/acentos.
- **Rodada.status**: `Emparelhamento` → `Em Andamento` → `Finalizada`. Exceção: a Rodada 1 é criada por
  `torneios/{id}/iniciar/` já `Em Andamento` (emparelhamento aleatório, sem fase de edição).
  As seguintes nascem em `Emparelhamento` via `proxima_rodada` (emparelhamento "Swiss").
  `Rodada.data_inicio` é gravado quando a rodada vira `Em Andamento` — **sempre** grave ao mudar esse status.
- **Jogador ativo** = `Inscricao.status == 'Inscrito'` — use `emparelhamento.inscricoes_ativas()`.
- **Mesa**: 4 jogadores, 2 por time (`MesaJogador.time` = 1|2). `time_vencedor`: 1, 2, 0=empate, null=pendente.
- **Bye/sobressalente**: jogador ativo que não está em nenhuma mesa da rodada (implícito, não há registro).
  Ganha `pontuacao_bye` nos pontos (só se já estava inscrito no início da rodada), mas byes são
  **excluídos** dos desempates (MW/OMW/PMW).
- **Ranking**: pontos → Balanço (OMW% − PMW%) → OMW% → MW%. Calculado e gravado em `RankingParcial`
  ao finalizar cada rodada (`proxima_rodada`/`finalizar`). Detalhes em `docs/algoritmo-ranking-2v2.md`
  e `docs/bye-e-desempate.md`.
- **Inscricao.status**: `Inscrito` | `Cancelado` (soft delete com `data_saida`). Torneio `Aberto` → o front
  faz hard DELETE; `Em Andamento` → `POST .../desinscrever/`.

## Convenções

- FKs nomeadas `id_xxx` (ex: `id_torneio`, `id_usuario`) — no ORM `inscricao.id_torneio` é o objeto,
  `inscricao.id_torneio_id` é o inteiro.
- Endpoints extras via `@action` do DRF; base `/api/v1/torneios/{torneios|inscricoes|rodadas|mesas}/` e `/api/v1/auth/`.
- Auth: sessão Django por cookie (`SessionAuthenticationSemCSRF` — CSRF desligado), cookie `SameSite=None; Secure`.
- Front: um serviço por domínio em `src/services`, tipos em `src/tipos/tipos.ts`, componentes com `index.tsx` +
  `*.module.css`. Alertas com `Swal.fire`. Erros de API tratados com `tratarErroTorneio`.
- O backend **não tem paginação** configurada: listas vêm como array; o front já normaliza (`results` ou array).

## Armadilhas conhecidas (ver backlog completo em ANALISE_TECNICA.md)

- `has_object_permission` só roda via `get_object()`/`check_object_permissions()` — ações que buscam o objeto
  na mão (ex: `select_for_update`) precisam chamar `self.check_object_permissions(request, obj)`.
- Ações de gestão em Rodada/Mesa usam `PERMISSOES_GESTAO` (`views.py`) — não volte a usar só `IsLojaOuAdmin`,
  senão uma loja altera torneio de outra.
- `return Response(400)` dentro de `transaction.atomic()` **não** desfaz o que já foi gravado — valide antes.
- Migrations: a `torneios/0001_initial` já tem o schema todo; não recrie migrations antigas. O banco local do
  Guilherme tem registros órfãos de `torneios/0002_inscricao...`/`0003_rankingparcial...` (inofensivos).
- Qualquer um pode se cadastrar como `LOJA` (decisão de produto pendente); `ADMIN` só por outro admin.
