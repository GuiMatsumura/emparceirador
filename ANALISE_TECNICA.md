# Análise técnica — Commander 150

> Levantamento inicial em 2026-10-06 sobre o `main` (commit `2358dde`, 2025-12-25), atualizado no mesmo dia
> após a rodada de correções (seção 6). Referências `arquivo:linha` apontam para o estado do código
> após as correções. Atualize este arquivo conforme o código mudar.

## 1. Visão geral

| Item | Valor |
|---|---|
| Backend | Django 5.2.6 + DRF 3.16, drf-yasg (Swagger), django-filter, django-cors-headers, gunicorn |
| Banco | PostgreSQL (Neon em produção) via `DATABASE_URL` |
| Frontend | React 19, TypeScript 5.8, Vite 7, react-router-dom 7, axios, sweetalert2, react-icons |
| Auth | Sessão Django (cookie `sessionid`), CSRF desativado (`usuarios/authentication.py`) |
| Deploy | Render (API) + Vercel (front) — URL pública: https://pmv-ads-2025-2-e5-proj-empext-t3-co.vercel.app |
| Testes | 41 testes de API no backend (`torneios/tests.py`, `usuarios/tests.py`), SQLite em memória via `core/settings_test.py` |
| Verificação | `manage.py check` OK · `makemigrations --check` OK · testes 41/41 · `tsc -b` OK · `eslint` 101 erros / 10 warnings (pré-existentes) |

Tamanho: backend ~3.000 linhas Python úteis (quase tudo em `torneios/views.py`), frontend ~9.000 linhas TS/TSX + CSS.

## 2. Modelo de dados

```
Usuario (AbstractUser; USERNAME_FIELD=email)
  tipo: JOGADOR|LOJA|ADMIN · status ("ativo") · token_redefinir_senha · token_redefinir_senha_criado_em
    │1
    │N
Torneio ── id_loja → Usuario
  nome, descricao, regras, status, banner (nome de arquivo: b1.png/b2.png/b3.png — assets do front)
  vagas_limitadas, qnt_vagas, incricao_gratuita, valor_incricao   (sic: "incricao")
  pontuacao_vitoria=3, pontuacao_derrota=0, pontuacao_empate=1, pontuacao_bye=3
  quantidade_rodadas (limite de rodadas, opcional), data_inicio
    │1                        │1                       │1
    │N                        │N                       │N
Inscricao                  Rodada                   RankingParcial
  id_usuario, id_torneio     numero_rodada, status,   id_usuario, rodada_numero, pontos_totais,
  decklist, status,          data_inicio (quando      mw/omw/pmw_percentage, balanco, posicao
  data_inscricao,            ficou Em Andamento)      unique(torneio, usuario, rodada_numero)
  data_saida                 unique(torneio, nº)
  unique(usuario, torneio)     │1
                               │N
                             Mesa
                               numero_mesa, time_vencedor (1|2|0|null),
                               pontuacao_time_1, pontuacao_time_2
                                 │1
                                 │N
                               MesaJogador  id_usuario, time (1|2)  unique(mesa, usuario)
```

### Migrations
- `torneios/0001_initial` (commitada) já contém **tudo** até RankingParcial e índices — foi recriada no commit de deploy.
- `torneios/0002_rodada_data_inicio` e `usuarios/0002_usuario_token_redefinir_senha_criado_em`: novas (2026-10-06).
- Existiam localmente (não versionadas) `torneios/0002_inscricao_data_saida...` e `0003_rankingparcial...`: eram
  **sobras da época antes da 0001 ser recriada** e conflitavam com ela (`duplicate column data_saida`). Foram
  movidas para fora do repo (backup no scratchpad da sessão). O banco local do Guilherme ainda tem esses dois
  nomes registrados em `django_migrations` — é inofensivo (o schema bate), mas pode ser limpo com
  `DELETE FROM django_migrations WHERE app='torneios' AND name IN ('0002_inscricao_data_saida_alter_inscricao_data_inscricao_and_more','0003_rankingparcial_mesajogador_jogador_mesa_idx_and_more');`

## 3. Mapa da API (`/api/v1/...`)

### Auth — `usuarios/views.py`
| Método | Rota | Permissão | Observação |
|---|---|---|---|
| POST | `auth/login/` | público | `{email, password}` → `{dados: Usuario}` + cookie |
| POST | `auth/logout/` | logado | |
| GET | `auth/validar-sessao/` | público | 200 + usuário, ou 204 sem sessão |
| POST | `auth/requisitar-troca-senha/` | público | envia token de 16 chars por e-mail (válido por 30 min) |
| POST | `auth/validar-token-redefinir-senha/` | público | gera senha aleatória de 8 chars e envia por e-mail |
| POST | `auth/alterar-senha/{user_id}/` | dono ou admin | `{senha_antiga, nova_senha}`; nova senha passa pelos validadores do Django |
| CRUD | `auth/usuarios/` | create público; resto dono/admin | create: `tipo` JOGADOR/LOJA (ADMIN só por admin logado); senha validada. `tipo` é read-only na edição |

### Torneios — `torneios/views.py`
| Método | Rota | Permissão | Linha |
|---|---|---|---|
| GET/POST/PUT/DELETE | `torneios/torneios/` (`?status=Aberto,Em Andamento`) | leitura pública; escrita LOJA (só os seus)/ADMIN | 108 |
| POST | `torneios/torneios/{id}/cancelar/` `{confirmacao:true}` | LOJA dona/ADMIN | 261 |
| POST | `torneios/torneios/{id}/iniciar/` | LOJA dona/ADMIN | 328 |
| POST | `torneios/torneios/{id}/proxima_rodada/` | LOJA dona/ADMIN | 415 |
| POST | `torneios/torneios/{id}/finalizar/` | LOJA dona/ADMIN | 540 |
| GET | `torneios/torneios/{id}/ranking_rodada/?rodada_id=` | público | 658 |
| CRUD | `torneios/inscricoes/` (`?id_torneio=`) | logado; queryset filtrado por tipo | 758 |
| POST | `torneios/inscricoes/{id}/desinscrever/` | dono da inscrição/loja dona/admin | 894 |
| POST | `torneios/inscricoes/{id}/reativar/` | LOJA dona/ADMIN | 937 |
| POST | `torneios/inscricoes/inscrever_por_email/` `{torneio_id, email}` | LOJA dona/ADMIN | 969 |
| CRUD | `torneios/rodadas/` (`?torneio_id=`) | leitura pública; escrita LOJA dona/ADMIN | 1043 |
| POST | `torneios/rodadas/alterar_jogador_mesa/` `{mesa_id, jogador_id, time, position}` | LOJA dona/ADMIN | 1096 |
| GET | `torneios/rodadas/{id}/mesas/` | público | 1195 |
| GET | `torneios/rodadas/{id}/sobressalentes/` | público | 1250 |
| GET | `torneios/rodadas/{id}/emparelhamento/` | LOJA dona/ADMIN | 1293 |
| POST | `torneios/rodadas/{id}/emparelhar_automatico/` `{tipo: random|swiss}` | LOJA dona/ADMIN | 1352 |
| POST | `torneios/rodadas/{id}/reemparelhar/` | LOJA dona/ADMIN | 1391 |
| POST | `torneios/rodadas/{id}/editar_emparelhamento/` `{acao, jogador_id, nova_mesa_id|novo_time}` | LOJA dona/ADMIN | 1423 |
| POST | `torneios/rodadas/{id}/iniciar_rodada/` `{forcar_inicio}` | LOJA dona/ADMIN | 1466 |
| CRUD | `torneios/mesas/` (`?rodada_id=`) | leitura pública; escrita LOJA dona/ADMIN | 1539 |
| POST | `torneios/mesas/{id}/reportar_resultado/` | jogador que está na mesa | 1597 |
| PATCH | `torneios/mesas/{id}/editar_manual/` `{pontuacao_time_1, pontuacao_time_2, time_vencedor}` | LOJA dona/ADMIN | 1642 |
| PATCH | `torneios/mesas/{id}/editar_jogadores/` | LOJA dona/ADMIN | 1660 |
| GET | `torneios/mesas/minha_mesa_na_rodada/?rodada_id=` | logado | 1686 |

Observações gerais:
- "LOJA dona" = `IsDonoDoTorneioOuAdmin` (`permissoes.py`) ou `verificar_dono_do_torneio` (`views.py`); para torneios, o `get_queryset` já restringe a loja aos seus.
- `TorneioViewSet.get_queryset`: na **listagem**, torneios `Aberto` somem 1h após `data_inicio`; detalhe e ações continuam acessíveis. Ordena Em Andamento → Aberto → resto, depois por data.
- `TorneioViewSet` e `InscricaoViewSet` não aceitam PATCH (`http_method_names`).

## 4. Fluxo do torneio (ponta a ponta)

1. **LOJA cria** torneio (`/criar-evento/`) → status `Aberto`. Validação: `data_inicio` não pode ser passada.
2. **Inscrições**: jogador via `/inscricao-torneio/:id` (POST `inscricoes/`) ou loja via modal (`inscrever_por_email`). Bloqueia se torneio não está `Aberto`, se data já passou, ou vagas esgotadas (contam só inscrições `Inscrito`).
3. **Iniciar** (`iniciar`, ≥4 inscritos ativos): torneio → `Em Andamento`; cria Rodada 1 **já `Em Andamento`** (com `data_inicio`), emparelhamento aleatório. Sobra (`n % 4`) = bye.
4. **Durante a rodada**: jogador vê sua mesa em `/intervalo/:id` (polling 30s em `mesa-ativa`) e reporta resultado (`reportar_resultado`). Loja confirma/edita via `editar_manual` (no front, "mesas confirmadas" ficam em `localStorage`).
5. **Próxima rodada** (`proxima_rodada`): exige rodada atual `Em Andamento`, todas as mesas com resultado e não ter atingido `quantidade_rodadas`; rodada atual → `Finalizada`; calcula `RankingParcial`; cria rodada N+1 em `Emparelhamento` e já emparelha via Swiss.
6. **Fase de emparelhamento** (loja): `reemparelhar`, `emparelhar_automatico`, `editar_emparelhamento`, `alterar_jogador_mesa` (usado pelo `CardMesaParticipante`) e então `iniciar_rodada` (exige mesas com 4, salvo `forcar_inicio`) → `Em Andamento` + `data_inicio`.
7. **Finalizar** (`finalizar`): exige resultados completos; rodada → `Finalizada`; ranking final; torneio → `Finalizado`.

### Emparelhamento (`torneios/emparelhamento.py`)
- **Jogador ativo** = inscrição com `status='Inscrito'` (`inscricoes_ativas`) — critério único em todo o backend.
- `emparelhar_aleatorio`: embaralha, mesas de 4 (2 primeiros = Time 1).
- `emparelhar_swiss`: pontos acumulados até a última rodada finalizada (mesmo cálculo do ranking), desempate aleatório; byes vão para quem teve menos byes (depois menor pontuação); em cada grupo de 4, escolhe entre as 3 divisões possíveis a que menos repete parceiros (preferência 1º+4º vs 2º+3º). Não troca jogadores entre grupos — repetições ainda podem ocorrer em torneios longos/pequenos.

### Ranking (`torneios/ranking_utils.py`)
- `construir_historico_ate_rodada`: lê rodadas `Finalizada` ≤ N; monta pontos/parceiro/oponentes por jogador/rodada. Jogador `Inscrito` sem mesa numa rodada recebe bye **se já estava inscrito quando a rodada começou** (`data_inscricao <= rodada.data_inicio`; rodadas antigas sem `data_inicio` dão bye como antes).
- MW% = pontos em partidas reais / (rodadas reais × pontos_vitoria), piso 1%. Byes excluídos.
- OMW%/PMW% = média do MW% *ajustado* (exclui rodadas compartilhadas com o jogador e byes) dos oponentes/parceiros únicos. Balanço = OMW − PMW.
- Ordenação: `(pontos, balanco, omw, mw)` desc. Persistido em `RankingParcial` (delete + bulk_create).

## 5. Frontend

Rotas (`src/routes/AppRoutes.tsx`):
| Rota | Página | Acesso |
|---|---|---|
| `/` | `App.tsx` — home com torneios ativos (Aberto/Em Andamento) | público |
| `/login/`, `/cadastrar/`, `/recuperar-senha/` | `pages/auth/*` | público |
| `/alterar-senha/` | `pages/auth/alterar-senha` | logado |
| `/criar-evento/` | `pages/Torneio/criar` | logado (sem checar tipo) |
| `/historico/` | `pages/Torneio/historico` — abas "Meus ingressos/eventos" | logado |
| `/inscricao-torneio/:id` | `pages/Torneio/inscrever` | logado |
| `/torneios/:id` | `TorneioRouter` → LOJA: `infoTorneioLoja` · demais: `infoTorneio` | logado |
| `/intervalo/:id` | `pages/Mesa/intervalo` (+ `mesa-ativa` embutido) — visão do jogador | logado |
| `/torneios/emparelhamento/` | `pages/Torneio/emparelhamento` — usa `useParams().id` mas a rota não tem `:id` (provável legado) | logado |
| `/jogador/`, `/loja/`, `/admin/` | `pages/Testes/*` / `App` — páginas de teste | logado |

Pontos-chave:
- `infoTorneioLoja/index.tsx` (2164 linhas) concentra praticamente toda a operação da loja. Candidato natural a ser quebrado em hooks/componentes.
- `RotaSegura` só verifica se há usuário logado; a separação por tipo é feita dentro das páginas/navbar.
- Tipos (`src/tipos/tipos.ts`) têm campos que o backend não envia (`data_fim`, `data_criacao`, paginação `IListaTorneios`), e `IRodada.status` documenta valores antigos ("Aguardando").
- `torneioServico.ts` tem funções não usadas/duplicadas e blocos comentados (`atualizarTorneioParcial` usa PATCH, que a API rejeita com 405; `proximaRodadaTorneio` vs `proximaRodadaNovo`; `editarEmparelhamento` vs `editarEmparelhamentoManual`).
- `tratarErroTorneio` troca toda resposta 400 por "Dados inválidos..." e esconde o `detail` da API (algumas telas leem `detail` antes, outras não).
- Login usa `minLength=4` (`qtdCaracteresSenha`); o backend agora exige senha forte (≥8, não comum, não só números) apenas em **cadastro e troca de senha** — o login de contas antigas continua funcionando.

## 6. Backlog

Severidade: 🔴 alta · 🟠 média · 🟡 baixa. Cada item corrigido tem teste em `torneios/tests.py` ou `usuarios/tests.py`.

### Bugs / segurança
- [x] 🔴 **B1 — `reportar_resultado` sem controle de acesso.** Agora exige login e que o usuário esteja na mesa (`check_object_permissions`); mesa inexistente → 404 (antes 500).
- [x] 🔴 **B2 — `editar_emparelhamento` duplicado** (2ª definição sobrescrevia a 1ª e sempre devolvia 400). Removida a versão quebrada; mover jogador valida que a mesa é da rodada e que o jogador está inscrito.
- [x] 🔴 **B3 — Escalada de privilégio no cadastro.** `tipo=ADMIN` só pode ser criado por admin logado. (Auto-cadastro como `LOJA` continua permitido — é o fluxo atual da UI; se o parceiro quiser aprovação de lojas, é uma feature nova.)
- [x] 🔴 **B4 — (diagnóstico corrigido)** As migrations "faltando" eram, na verdade, sobras locais obsoletas que conflitavam com a `0001` commitada. Removidas do repo (ver seção 2).
- [x] 🟠 **B5 — Loja alterava dados de torneio de outra loja.** `IsDonoDoTorneioOuAdmin` em Rodada/Mesa (CRUD e ações), checagem no `create`, e `perform_update` impede loja de trocar `id_loja` do torneio. `editar_manual` agora só altera placar/vencedor (com validação de coerência).
- [x] 🟠 **B6 — `desinscrever` não gravava `data_saida`.**
- [x] 🟠 **B7 — Contagem de vagas incluía inscrições canceladas.**
- [x] 🟠 **B8 — Critério de "jogador ativo" inconsistente.** Unificado em `emparelhamento.inscricoes_ativas` (`status='Inscrito'`).
- [x] 🟠 **B9 — Bye retroativo para inscrição tardia.** Novo `Rodada.data_inicio`; bye só se inscrito antes do início da rodada.
- [x] 🟠 **B10 — Jogador reativava a própria inscrição.** `reativar` agora é só LOJA dona/ADMIN.
- [x] 🟡 **B11 — Swiss sem desempate aleatório, sem rotação de bye e sem evitar parceiro repetido.** Ver seção 4.
- [x] 🟡 **B12 — `quantidade_rodadas` ignorado.** `proxima_rodada` devolve 400 ao atingir o limite.
- [x] 🟡 **B13 — Senhas/token.** Token de redefinição expira em 30 min; cadastro e troca de senha passam por `AUTH_PASSWORD_VALIDATORS`. *Pendente:* o fluxo ainda envia a nova senha em texto puro por e-mail (mudar para "definir nova senha via link" exige mudança no front).
- [x] 🟡 **B14 — `print` de debug** em `inscrever_por_email`.
- [x] 🟠 **B15 — Loja não conseguia abrir/iniciar torneio `Aberto` com mais de 1h de atraso** (o filtro de tolerância valia também para detalhe/ações → 404). Agora só na listagem.
- [x] 🟠 **B16 — `emparelhar_automatico` apagava as mesas antes de validar ≥4 jogadores** (o `return 400` dentro do `atomic` não desfazia a exclusão).
- [x] 🟡 **B17 — `proxima_rodada`/`finalizar` sem nenhuma rodada → 500.** Agora 400.

### Pendências / dívida técnica
- [ ] Fluxo de redefinição de senha por link (ver B13).
- [ ] `tratarErroTorneio` (front) deveria mostrar `detail` da API nas respostas 400.
- [ ] Possível exigência de aprovação para contas `LOJA` (decisão de produto).
- [ ] Status como strings soltas — criar `TextChoices` para Torneio/Rodada/Inscricao.
- [ ] `views.py` (~1.700 linhas) e `infoTorneioLoja/index.tsx` (~2.160) — dividir.
- [ ] Testes no frontend (não há framework configurado).
- [ ] ESLint com 101 erros (maioria `no-explicit-any`).
- [ ] Arquivos soltos/untracked: `torneios/banners/*.png` (sobra de quando banner era upload; hoje é `CharField`), `.md`s de documentação do backend e `DEPLOY_E_CUSTOS.md` na raiz — decidir se commita.
- [x] ~~Lógica Swiss duplicada em 4 lugares~~ → `torneios/emparelhamento.py`. Helpers mortos removidos.
- [x] ~~N+1 no fallback de `ranking_rodada`~~.
- [ ] READMEs desatualizados (`codigo-fonte/backend/README.md` ainda descreve `DB_*` em vez de `DATABASE_URL`; `frontend/README.md` é o template do Vite).

## 7. Documentos existentes úteis

| Arquivo | Conteúdo |
|---|---|
| `documentos/02-Especificação do Projeto.md` | Requisitos RF-001..016 e RNF-001..015 |
| `documentos/05-Implantação.md` | Render + Vercel/Netlify |
| `codigo-fonte/backend/README.md` | Setup local do backend |
| `codigo-fonte/backend/api/ALGORITMO_PAREAMENTO_2V2.md` | Especificação do desempate (1144 linhas) |
| `codigo-fonte/backend/api/TRATAMENTO_BYE_DESEMPATE.md` | Regra do bye nos desempates |
| `codigo-fonte/backend/api/GUIA_TESTES_BYE.md` | Cenários de teste manual do ranking |
| `codigo-fonte/backend/api/SEED_DATABASE.md` | SQL para popular o banco (senhas são placeholders inválidos) |
| `DEPLOY_E_CUSTOS.md` | Estudo de deploy e custos |
