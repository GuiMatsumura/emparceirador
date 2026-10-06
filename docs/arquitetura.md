# Arquitetura

Visão técnica do Commander 150: como as partes se organizam, as regras de negócio centrais e as decisões
tomadas. Para rodar o projeto, veja o [README](../README.md).

## Visão geral

```
Navegador ──► frontend (React SPA, Vercel)
                 │  axios, cookie de sessão (withCredentials)
                 ▼
              backend (Django + DRF, Render) ──► PostgreSQL (Neon)
```

- Autenticação por **sessão do Django** (cookie `sessionid`). Como frontend e API ficam em domínios
  diferentes, o cookie usa `SameSite=None; Secure`.
- Proteção contra CSRF por **verificação de origem** (`usuarios/authentication.py`): escritas vindas de
  navegador só são aceitas se o `Origin`/`Referer` estiver em `CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS`.
  O token CSRF clássico (cookie + header) não funciona entre domínios.

## Backend (`backend/`)

| Módulo | Responsabilidade |
|---|---|
| `core/settings.py` | Configuração via variáveis de ambiente (`backend/.env.example`). Em produção, `SECRET_KEY` é obrigatória. |
| `usuarios/` | `Usuario` (login por e-mail, `tipo` JOGADOR/LOJA/ADMIN), login/logout, cadastro, troca e redefinição de senha. |
| `torneios/models.py` | `Torneio`, `Inscricao`, `Rodada`, `Mesa`, `MesaJogador`, `RankingParcial`. Status com `TextChoices`. |
| `torneios/servicos.py` | **Regras de negócio**: iniciar/avançar/finalizar/cancelar torneio, emparelhar e iniciar rodada, posicionar jogadores, resultados, inscrições. |
| `torneios/emparelhamento.py` | Emparelhamento aleatório (rodada 1) e Swiss (demais). |
| `torneios/ranking.py` | Cálculo do ranking e critérios de desempate; formatação do ranking para a API. |
| `torneios/views/` | ViewSets por recurso. Só HTTP: permissões, validação de entrada, formato de resposta. |
| `torneios/permissoes.py` | `IsLojaOuAdmin`, `IsDonoDoTorneioOuAdmin`, `IsJogadorNaMesa`, `PERMISSOES_GESTAO`. |
| `torneios/excecoes.py` | `RegraDeNegocio`: erro de regra → HTTP 400 `{"detail": "..."}`. |

Camadas: **view → serviço → modelos**. Views não contêm regra de negócio; serviços não conhecem HTTP
(exceto `RegraDeNegocio`, que é uma `APIException`).

### Ciclo de vida

```
Torneio:  Aberto ──iniciar──► Em Andamento ──finalizar──► Finalizado
             └──cancelar──► Cancelado

Rodada:   Emparelhamento ──iniciar_rodada──► Em Andamento ──proxima_rodada/finalizar──► Finalizada
          (a Rodada 1 já nasce Em Andamento, com emparelhamento aleatório)
```

- `proxima_rodada` exige todas as mesas com resultado, respeita `quantidade_rodadas`, calcula o
  `RankingParcial` da rodada encerrada e cria a próxima já emparelhada (Swiss) em `Emparelhamento`.
- `finalizar` descarta uma rodada que ainda esteja em emparelhamento (não jogada).
- `Rodada.data_inicio` é gravado quando a rodada entra em andamento.

### Regras importantes

- **Jogador ativo** = inscrição com status `Inscrito` (`Inscricao.objects.ativas()`), critério único.
- **Bye**: jogador ativo fora das mesas de uma rodada. Recebe `pontuacao_bye`, mas só se já estava
  inscrito quando a rodada começou. Byes não entram nos critérios de desempate.
- **Swiss**: ordena por pontos (desempate aleatório), dá o bye a quem teve menos byes e, em cada mesa,
  escolhe a divisão de duplas que menos repete parceiros.
- **Ranking**: pontos → Balanço (OMW% − PMW%) → OMW% → MW%. Detalhes em [algoritmo-ranking-2v2.md](algoritmo-ranking-2v2.md)
  e [bye-e-desempate.md](bye-e-desempate.md). Editar um resultado de rodada finalizada recalcula o ranking.
- **Inscrições**: o jogador se inscreve só em torneio aberto e antes do início; a loja pode inscrever
  também com o torneio em andamento. Saída: exclusão antes de começar, `Cancelado` (soft delete) depois.
- **Permissões**: leitura de torneios/rodadas/mesas é pública; gestão é da loja dona do torneio ou do admin;
  resultado só pode ser reportado por um jogador da mesa. Cadastro público cria JOGADOR ou LOJA.

### Testes

`python manage.py test --settings=core.settings_test` (SQLite em memória). Os testes de API ficam em
`torneios/tests.py` e `usuarios/tests.py`; cada bug corrigido tem um teste que falhava antes da correção.

## Frontend (`frontend/src/`)

| Pasta | Responsabilidade |
|---|---|
| `services/` | Cliente HTTP por domínio (`torneio`, `inscricao`, `rodada`, `mesa`, `auth`). Propagam erros. |
| `tipos/tipos.ts` | Tipos que espelham as respostas da API. |
| `utils/` | `mensagemDeErro`, formatação (datas, moeda), alertas (SweetAlert2 com títulos em texto puro), banners. |
| `contextos/AuthContexto.tsx` | Usuário logado e login/logout (`useSessao`). |
| `routes/` | Rotas; `RotaSegura` exige login e, opcionalmente, um tipo de usuário. |
| `pages/` | Telas. A gestão da loja (`Torneio/infoTorneioLoja`) é dividida em hook de dados, ações e modal. |
| `components/` | Componentes reutilizáveis (cards, modais, inputs). |

Convenções:
- Erros da API são exibidos com `alertarErro(titulo, erro)`, que extrai `detail` ou os erros de campo.
- Conteúdo vindo de usuários (nomes) nunca é interpolado em `html` de alertas sem `escaparHtml`.
- Datas: a API envia ISO 8601 com fuso; inputs `datetime-local` são convertidos com `isoParaInputLocal`/`inputLocalParaIso`.

## Decisões e pendências

- **FKs nomeadas `id_xxx`** (`id_torneio`, `id_usuario`): mantidas para não quebrar o contrato da API e o
  banco existente. No ORM, `inscricao.id_torneio` é o objeto e `inscricao.id_torneio_id` o inteiro.
- **"Mesa confirmada" pela loja** é só uma marca visual no navegador (`localStorage`); a API não tem esse
  conceito. Se for importante entre dispositivos, vira um campo em `Mesa`.
- **Redefinição de senha** ainda envia uma senha nova por e-mail; o ideal é um link para o usuário definir
  a senha.
- **Cadastro de LOJA** é livre; se o parceiro quiser aprovação de lojas, é uma funcionalidade nova.
- Não há testes automatizados no frontend.
