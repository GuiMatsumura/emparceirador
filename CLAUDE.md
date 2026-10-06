# Commander 150 — guia rápido

Sistema web para torneios de **Magic: The Gathering 2v2 com duplas aleatórias**. Repositório:
GuiMatsumura/emparceirador. Código, comentários, mensagens da API e commits são em **português**.

Arquitetura, regras de negócio e decisões: **[docs/arquitetura.md](docs/arquitetura.md)** (leia antes de mexer
em torneio/rodada/ranking).

## Estrutura

```
backend/        Django 5.2 + DRF (Python 3.12)
  core/         settings (env vars), urls, settings_test (SQLite em memória)
  usuarios/     usuário (login por e-mail), auth, senha
  torneios/     models, servicos.py (regras), emparelhamento.py, ranking.py, views/ (HTTP), permissoes.py
frontend/       React 19 + TypeScript + Vite
  src/services  API por domínio · src/utils erros/formatação/alertas · src/tipos tipos da API
docs/           arquitetura, algoritmo de ranking, bye, deploy
```

## Comandos

```bash
# backend/  (venv em backend/.venv)
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py popular_exemplo          # loja@exemplo.com / jogador1..9@exemplo.com, senha: senha-exemplo-123
python manage.py runserver
python manage.py test --settings=core.settings_test
ruff check . && ruff format --check .

# frontend/
npm install && npm run dev                # VITE_API_BASE_URL em frontend/.env
npm run lint && npm run build
```

O CI (`.github/workflows/ci.yml`) roda lint, checks do Django e testes do backend, e lint e build do frontend.
Mantenha tudo verde.

## Como trabalhar aqui

- Regra de negócio nova vai em `torneios/servicos.py` (levante `RegraDeNegocio` para erros de regra);
  views só cuidam de HTTP.
- Bug corrigido ganha teste que falha antes da correção (`torneios/tests.py`, `usuarios/tests.py`).
- Jogador ativo: sempre `Inscricao.objects.ativas()`. Ao mudar uma rodada para `Em Andamento`, grave `data_inicio`.
- Ações de gestão usam `PERMISSOES_GESTAO`. `has_object_permission` só roda via `get_object()` ou
  `check_object_permissions()`.
- `return Response(400)` dentro de `transaction.atomic()` não desfaz o que já foi gravado: valide antes.
- Front: chamadas à API só pelos `services/`; erros com `alertarErro`; texto de usuário em HTML só com `escaparHtml`.
- Commits sem linhas de coautoria/assinatura do Claude.

## Ambiente local do Guilherme

O Postgres local (DATABASE_URL em `backend/core/.env`) tem registros órfãos em `django_migrations`
(`torneios.0002_inscricao...`/`0003_rankingparcial...`, de antes da 0001 ser recriada). São inofensivos.
As migrations novas (`torneios.0002`–`0004`, `usuarios.0002`–`0004`) ainda não foram aplicadas nele.
