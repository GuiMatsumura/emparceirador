# Commander 150

Sistema web para organizar torneios de **Magic: The Gathering no formato 2v2 com duplas aleatórias** — modalidade
cooperativa sem suporte oficial, normalmente organizada à mão pelas lojas.

A aplicação cuida de inscrições, geração de rodadas e mesas, registro de resultados, pontuação e ranking com
critérios de desempate próprios para duplas aleatórias.

## Funcionalidades

- **Jogador:** cadastro/login, inscrição em torneios, visualização da mesa da rodada, report de resultado, ranking.
- **Loja:** criação e edição de torneios (pontuação configurável), gestão de inscrições, emparelhamento automático
  (aleatório na 1ª rodada, Swiss nas seguintes) com ajustes manuais, confirmação de resultados, finalização.
- **Ranking:** pontos → Balanço (OMW% − PMW%) → OMW% → MW%. Detalhes em [docs/algoritmo-ranking-2v2.md](docs/algoritmo-ranking-2v2.md).

## Stack

| Camada | Tecnologias |
|---|---|
| Backend | Python 3.12, Django 5.2, Django REST Framework, PostgreSQL, drf-yasg (Swagger) |
| Frontend | React 19, TypeScript, Vite, React Router, Axios, SweetAlert2 |
| Autenticação | Sessão Django (cookie) |

## Estrutura

```
backend/            API Django
  core/             settings, urls, wsgi
  usuarios/         usuário customizado (login por e-mail), autenticação, redefinição de senha
  torneios/         torneios, inscrições, rodadas, mesas, emparelhamento e ranking
frontend/           SPA React + Vite
  src/services/     cliente HTTP por domínio
  src/pages/        telas
  src/components/   componentes reutilizáveis
docs/               documentação técnica (ranking, bye, deploy)
```

## Rodando localmente

### Backend

Pré-requisitos: Python 3.12+ e PostgreSQL.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example core/.env        # ajuste DATABASE_URL e demais variáveis
python manage.py migrate
python manage.py runserver
```

A API sobe em `http://localhost:8000/api/v1/`. Documentação interativa em `/swagger/` e `/redoc/`.

### Frontend

Pré-requisitos: Node 20+.

```bash
cd frontend
npm install
cp .env.example .env             # VITE_API_BASE_URL=http://localhost:8000/api/v1
npm run dev
```

A aplicação abre em `http://localhost:5173`.

## Testes e qualidade

```bash
cd backend && python manage.py test --settings=core.settings_test   # SQLite em memória
cd frontend && npm run lint && npm run build
```

## Créditos

Projeto criado originalmente como projeto de extensão do curso de Análise e Desenvolvimento de Sistemas da
PUC Minas (2025/2) por Gabriela Franklin Sá de Moura, Guilherme Pena Matsumura, Lucas Campos de Abreu,
Rafael Costa Souza e Willams Andrade Lima, com orientação do Prof. José Wilson da Costa.
