"""
Emparelhamento de jogadores em mesas 2v2.

- Aleatório: usado na Rodada 1 (ninguém tem pontos ainda).
- Swiss: ordena por pontuação acumulada e forma grupos de 4 consecutivos.
  * Desempate de jogadores com a mesma pontuação é aleatório.
  * Byes (sobra de len % 4) vão para quem teve menos byes, preferindo os de menor pontuação.
  * Dentro de cada mesa, escolhe a divisão de duplas que menos repete parceiros anteriores
    (padrão: 1º + 4º vs 2º + 3º).
"""

import random

from .models import Inscricao, Mesa, MesaJogador
from .ranking import historico_anterior

# Divisões possíveis de um grupo de 4 (índices no grupo ordenado), em ordem de preferência.
DIVISOES_DUPLAS = [
    ((0, 3), (1, 2)),  # 1º + 4º vs 2º + 3º (equilibrado)
    ((0, 2), (1, 3)),
    ((0, 1), (2, 3)),
]


def jogadores_ativos_ids(torneio) -> list[int]:
    return list(Inscricao.objects.ativas().filter(id_torneio=torneio).values_list('id_usuario_id', flat=True))


def limpar_mesas(rodada):
    Mesa.objects.filter(id_rodada=rodada).delete()  # MesaJogador cai em cascata


def _criar_mesa(rodada, numero, time_1, time_2):
    mesa = Mesa.objects.create(id_rodada=rodada, numero_mesa=numero)
    MesaJogador.objects.bulk_create(
        [MesaJogador(id_mesa=mesa, id_usuario_id=j, time=1) for j in time_1]
        + [MesaJogador(id_mesa=mesa, id_usuario_id=j, time=2) for j in time_2]
    )
    return mesa


def emparelhar_aleatorio(rodada, jogadores: list[int]) -> int:
    """Embaralha e cria mesas de 4 (2 primeiros no Time 1). A sobra fica de bye. Retorna nº de mesas."""
    jogadores = list(jogadores)
    random.shuffle(jogadores)
    num_mesas = len(jogadores) // 4
    for i in range(num_mesas):
        grupo = jogadores[i * 4 : (i + 1) * 4]
        _criar_mesa(rodada, i + 1, grupo[:2], grupo[2:])
    return num_mesas


def _melhor_divisao(grupo: list[int], duplas_anteriores: set[frozenset[int]]):
    """Escolhe a divisão do grupo em duas duplas que menos repete parcerias anteriores."""

    def repeticoes(divisao):
        return sum(frozenset((grupo[a], grupo[b])) in duplas_anteriores for a, b in divisao)

    melhor = min(DIVISOES_DUPLAS, key=repeticoes)  # min é estável: empate mantém a ordem de preferência
    (a1, a2), (b1, b2) = melhor
    return [grupo[a1], grupo[a2]], [grupo[b1], grupo[b2]]


def emparelhar_swiss(rodada) -> int:
    """Cria as mesas da rodada pelo sistema Swiss adaptado ao 2v2. Retorna nº de mesas."""
    torneio = rodada.id_torneio
    jogadores = jogadores_ativos_ids(torneio)
    historico = historico_anterior(torneio, rodada.numero_rodada)
    pontos = {j: historico['mw_base'].get(j, 0) for j in jogadores}
    parceiros_hist = historico['parceiros']

    byes = {j: sum(1 for p in parceiros_hist.get(j, {}).values() if p is None) for j in jogadores}
    duplas_anteriores = {
        frozenset((j, p)) for j, por_rodada in parceiros_hist.items() for p in por_rodada.values() if p is not None
    }

    # Desempate aleatório: embaralha antes da ordenação estável por pontos
    random.shuffle(jogadores)
    ordenados = sorted(jogadores, key=lambda j: pontos[j], reverse=True)

    # Quem fica de bye: menos byes primeiro, depois menor pontuação, depois mais abaixo no ranking
    qtd_bye = len(ordenados) % 4
    if qtd_bye:
        posicao = {j: i for i, j in enumerate(ordenados)}
        candidatos = sorted(ordenados, key=lambda j: (byes[j], pontos[j], -posicao[j]))
        com_bye = set(candidatos[:qtd_bye])
        ordenados = [j for j in ordenados if j not in com_bye]

    num_mesas = len(ordenados) // 4
    for i in range(num_mesas):
        grupo = ordenados[i * 4 : (i + 1) * 4]
        time_1, time_2 = _melhor_divisao(grupo, duplas_anteriores)
        _criar_mesa(rodada, i + 1, time_1, time_2)
    return num_mesas
