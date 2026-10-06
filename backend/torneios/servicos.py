"""
Regras de negócio do ciclo de vida de um torneio.

As views cuidam de HTTP (permissões, parsing, formato de resposta); tudo o que muda o estado
de torneios, rodadas, mesas e inscrições passa por aqui. Violações de regra levantam
RegraDeNegocio (respondida como 400 pela API).
"""

from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from .emparelhamento import emparelhar_aleatorio, emparelhar_swiss, jogadores_ativos_ids, limpar_mesas
from .excecoes import RegraDeNegocio
from .models import Inscricao, Mesa, MesaJogador, Rodada, Torneio
from .ranking import calcular_e_salvar_ranking_parcial, ranking_salvo

MINIMO_JOGADORES = 4


# ------------------------------------------------------------------------------
# Torneio
# ------------------------------------------------------------------------------
@dataclass
class ResultadoInicio:
    rodada: Rodada
    mesas_criadas: int
    total_jogadores: int
    jogadores_com_bye: int


@dataclass
class ResultadoAvanco:
    rodada_anterior: Rodada
    nova_rodada: Rodada
    mesas_criadas: int


@dataclass
class ResultadoFinalizacao:
    ranking: list[dict]
    total_rodadas: int


def _exigir_status(torneio: Torneio, esperado: str):
    if torneio.status != esperado:
        raise RegraDeNegocio(f"Torneio deve estar '{esperado}'. Status atual: {torneio.status}")


def rodada_atual(torneio: Torneio) -> Rodada | None:
    return Rodada.objects.filter(id_torneio=torneio).order_by('-numero_rodada').first()


def cancelar_torneio(torneio: Torneio) -> Torneio:
    """Cancela um torneio ainda aberto. Inscrições e dados são mantidos para histórico."""
    _exigir_status(torneio, Torneio.Status.ABERTO)
    torneio.status = Torneio.Status.CANCELADO
    torneio.save(update_fields=['status'])
    return torneio


@transaction.atomic
def iniciar_torneio(torneio: Torneio) -> ResultadoInicio:
    """Abre a Rodada 1 já em andamento, com emparelhamento aleatório."""
    _exigir_status(torneio, Torneio.Status.ABERTO)
    jogadores = jogadores_ativos_ids(torneio)
    if len(jogadores) < MINIMO_JOGADORES:
        raise RegraDeNegocio(
            f'É necessário ter no mínimo {MINIMO_JOGADORES} jogadores inscritos. Total atual: {len(jogadores)}'
        )

    torneio.status = Torneio.Status.EM_ANDAMENTO
    torneio.save(update_fields=['status'])
    rodada = Rodada.objects.create(
        id_torneio=torneio, numero_rodada=1, status=Rodada.Status.EM_ANDAMENTO, data_inicio=timezone.now()
    )
    mesas = emparelhar_aleatorio(rodada, jogadores)
    return ResultadoInicio(rodada, mesas, len(jogadores), len(jogadores) % 4)


def _exigir_resultados_completos(rodada: Rodada):
    pendentes = Mesa.objects.filter(id_rodada=rodada, time_vencedor__isnull=True).count()
    if pendentes:
        raise RegraDeNegocio(f'Existem {pendentes} mesa(s) sem resultado reportado na rodada atual.')


def _encerrar_rodada(rodada: Rodada):
    rodada.status = Rodada.Status.FINALIZADA
    rodada.save(update_fields=['status'])
    calcular_e_salvar_ranking_parcial(rodada.id_torneio, rodada.numero_rodada)


@transaction.atomic
def avancar_rodada(torneio: Torneio) -> ResultadoAvanco:
    """Encerra a rodada em andamento e abre a próxima já emparelhada (Swiss), em fase de emparelhamento."""
    _exigir_status(torneio, Torneio.Status.EM_ANDAMENTO)
    atual = rodada_atual(torneio)
    if atual is None:
        raise RegraDeNegocio('Nenhuma rodada encontrada para este torneio.')
    if atual.status != Rodada.Status.EM_ANDAMENTO:
        raise RegraDeNegocio(f"Rodada atual deve estar 'Em Andamento'. Status atual: {atual.status}")
    _exigir_resultados_completos(atual)
    if torneio.quantidade_rodadas and atual.numero_rodada >= torneio.quantidade_rodadas:
        raise RegraDeNegocio(f'Número máximo de rodadas ({torneio.quantidade_rodadas}) atingido. Finalize o torneio.')

    _encerrar_rodada(atual)
    nova = Rodada.objects.create(
        id_torneio=torneio, numero_rodada=atual.numero_rodada + 1, status=Rodada.Status.EMPARELHAMENTO
    )
    mesas = emparelhar_swiss(nova)
    return ResultadoAvanco(atual, nova, mesas)


@transaction.atomic
def finalizar_torneio(torneio: Torneio) -> ResultadoFinalizacao:
    """
    Encerra o torneio e devolve o ranking final.

    Se a última rodada ainda está em emparelhamento (não foi jogada), ela é descartada.
    """
    _exigir_status(torneio, Torneio.Status.EM_ANDAMENTO)
    atual = rodada_atual(torneio)
    if atual is None:
        raise RegraDeNegocio('Nenhuma rodada encontrada para este torneio.')

    if atual.status == Rodada.Status.EMPARELHAMENTO:
        atual.delete()
        atual = rodada_atual(torneio)
        if atual is None:
            raise RegraDeNegocio('Nenhuma rodada foi jogada neste torneio.')

    if atual.status == Rodada.Status.EM_ANDAMENTO:
        _exigir_resultados_completos(atual)
        _encerrar_rodada(atual)

    torneio.status = Torneio.Status.FINALIZADO
    torneio.save(update_fields=['status'])
    return ResultadoFinalizacao(
        ranking=ranking_salvo(torneio, atual.numero_rodada),
        total_rodadas=Rodada.objects.filter(id_torneio=torneio).count(),
    )


# ------------------------------------------------------------------------------
# Rodada / emparelhamento
# ------------------------------------------------------------------------------
def _exigir_emparelhamento(rodada: Rodada):
    if rodada.status != Rodada.Status.EMPARELHAMENTO:
        raise RegraDeNegocio('A rodada não está em fase de emparelhamento.')


@transaction.atomic
def emparelhar_rodada(rodada: Rodada, tipo: str = 'swiss') -> int:
    """Descarta o emparelhamento atual da rodada e gera um novo ('random' ou 'swiss')."""
    _exigir_emparelhamento(rodada)
    jogadores = jogadores_ativos_ids(rodada.id_torneio)
    if len(jogadores) < MINIMO_JOGADORES:
        raise RegraDeNegocio(f'São necessários pelo menos {MINIMO_JOGADORES} jogadores.')

    limpar_mesas(rodada)
    if tipo == 'random':
        return emparelhar_aleatorio(rodada, jogadores)
    return emparelhar_swiss(rodada)


def iniciar_rodada(rodada: Rodada, forcar_inicio: bool = False) -> int:
    """Encerra a fase de emparelhamento: jogadores passam a poder reportar resultados."""
    _exigir_emparelhamento(rodada)
    mesas = list(Mesa.objects.filter(id_rodada=rodada).order_by('numero_mesa'))
    if not forcar_inicio:
        for mesa in mesas:
            quantidade = MesaJogador.objects.filter(id_mesa=mesa).count()
            if quantidade != 4:
                raise RegraDeNegocio(
                    f'Mesa {mesa.numero_mesa} tem {quantidade} jogadores. '
                    'Use forcar_inicio=true ou ajuste o emparelhamento.'
                )

    rodada.status = Rodada.Status.EM_ANDAMENTO
    rodada.data_inicio = timezone.now()
    rodada.save(update_fields=['status', 'data_inicio'])
    return len(mesas)


def _exigir_jogador_ativo(rodada: Rodada, jogador_id: int):
    if not Inscricao.objects.ativas().filter(id_torneio=rodada.id_torneio, id_usuario_id=jogador_id).exists():
        raise RegraDeNegocio('Jogador não está inscrito neste torneio.')


@transaction.atomic
def mover_jogador_para_mesa(rodada: Rodada, jogador_id: int, mesa_id: int):
    """Move um jogador para outra mesa da rodada (entra no Time 1)."""
    _exigir_emparelhamento(rodada)
    if not Mesa.objects.filter(id=mesa_id, id_rodada=rodada).exists():
        raise RegraDeNegocio('Mesa não pertence a esta rodada.')
    _exigir_jogador_ativo(rodada, jogador_id)

    MesaJogador.objects.filter(id_mesa__id_rodada=rodada, id_usuario_id=jogador_id).delete()
    MesaJogador.objects.create(id_mesa_id=mesa_id, id_usuario_id=jogador_id, time=1)


def alterar_time_jogador(rodada: Rodada, jogador_id: int, novo_time: int):
    _exigir_emparelhamento(rodada)
    alterados = MesaJogador.objects.filter(id_mesa__id_rodada=rodada, id_usuario_id=jogador_id).update(time=novo_time)
    if not alterados:
        raise RegraDeNegocio('Jogador não está em nenhuma mesa desta rodada.')


@transaction.atomic
def posicionar_jogador(mesa: Mesa, time: int, posicao: int, jogador_id: int | None) -> str:
    """
    Coloca um jogador numa posição (1 ou 2) de um time da mesa, ou esvazia a posição (jogador_id=None).

    O jogador é retirado de onde estiver na rodada; quem ocupava a posição sai da mesa.
    Devolve uma mensagem descrevendo o que foi feito.
    """
    rodada = mesa.id_rodada
    _exigir_emparelhamento(rodada)

    def ocupantes():
        return list(MesaJogador.objects.filter(id_mesa=mesa, time=time).order_by('id'))

    atuais = ocupantes()
    if jogador_id is None:
        if posicao <= len(atuais):
            atuais[posicao - 1].delete()
        return f'Jogador removido da posição {posicao} do Time {time}'

    _exigir_jogador_ativo(rodada, jogador_id)
    if posicao <= len(atuais) and atuais[posicao - 1].id_usuario_id == jogador_id:
        return f'Jogador já está na posição {posicao} do Time {time} da Mesa {mesa.numero_mesa}'

    MesaJogador.objects.filter(id_mesa__id_rodada=rodada, id_usuario_id=jogador_id).delete()
    atuais = ocupantes()
    if posicao <= len(atuais):
        atuais[posicao - 1].delete()
    MesaJogador.objects.create(id_mesa=mesa, id_usuario_id=jogador_id, time=time)
    return f'Jogador posicionado na posição {posicao} do Time {time} da Mesa {mesa.numero_mesa}'


# ------------------------------------------------------------------------------
# Resultado da mesa
# ------------------------------------------------------------------------------
def _validar_mesa_completa(mesa: Mesa):
    times = list(MesaJogador.objects.filter(id_mesa=mesa).values_list('time', flat=True))
    if len(times) != 4 or times.count(1) != 2 or times.count(2) != 2:
        raise RegraDeNegocio('Mesa inválida: é necessário haver 2 jogadores no Time 1 e 2 no Time 2 (2x2).')


def _gravar_resultado(mesa: Mesa, pontuacao_time_1: int, pontuacao_time_2: int, time_vencedor: int):
    mesa.pontuacao_time_1 = pontuacao_time_1
    mesa.pontuacao_time_2 = pontuacao_time_2
    mesa.time_vencedor = time_vencedor
    mesa.save(update_fields=['pontuacao_time_1', 'pontuacao_time_2', 'time_vencedor'])


@transaction.atomic
def reportar_resultado(mesa_id: int, pontuacao_time_1: int, pontuacao_time_2: int, time_vencedor: int) -> Mesa:
    """Resultado reportado por um jogador da mesa: só durante a rodada em andamento."""
    # Lock na linha da mesa: evita dois reports simultâneos da mesma mesa
    mesa = Mesa.objects.select_for_update().select_related('id_rodada').get(pk=mesa_id)
    if mesa.id_rodada.status != Rodada.Status.EM_ANDAMENTO:
        raise RegraDeNegocio("Não é possível reportar resultado: a rodada não está 'Em Andamento'.")
    _validar_mesa_completa(mesa)
    _gravar_resultado(mesa, pontuacao_time_1, pontuacao_time_2, time_vencedor)
    return mesa


@transaction.atomic
def editar_resultado(mesa: Mesa, pontuacao_time_1: int, pontuacao_time_2: int, time_vencedor: int) -> Mesa:
    """
    Edição de resultado pela loja, em qualquer rodada já iniciada.

    Se a rodada já foi finalizada, recalcula o ranking dela e das rodadas finalizadas seguintes.
    """
    rodada = mesa.id_rodada
    if rodada.status == Rodada.Status.EMPARELHAMENTO:
        raise RegraDeNegocio('A rodada ainda não começou.')
    _gravar_resultado(mesa, pontuacao_time_1, pontuacao_time_2, time_vencedor)

    if rodada.status == Rodada.Status.FINALIZADA:
        afetadas = Rodada.objects.filter(
            id_torneio=rodada.id_torneio, status=Rodada.Status.FINALIZADA, numero_rodada__gte=rodada.numero_rodada
        ).order_by('numero_rodada')
        for afetada in afetadas:
            calcular_e_salvar_ranking_parcial(rodada.id_torneio, afetada.numero_rodada)
    return mesa


# ------------------------------------------------------------------------------
# Inscrições
# ------------------------------------------------------------------------------
def validar_vaga(torneio: Torneio):
    if not torneio.vagas_limitadas or torneio.qnt_vagas is None:
        return
    if Inscricao.objects.ativas().filter(id_torneio=torneio).count() >= torneio.qnt_vagas:
        raise RegraDeNegocio(f'Limite de vagas atingido. Este torneio aceita apenas {torneio.qnt_vagas} jogadores.')


def desinscrever(inscricao: Inscricao) -> Inscricao:
    """Saída do torneio (soft delete): mantém o histórico de partidas e pontuação."""
    if inscricao.status == Inscricao.Status.CANCELADO:
        raise RegraDeNegocio('Esta inscrição já foi cancelada.')
    if inscricao.id_torneio.status == Torneio.Status.FINALIZADO:
        raise RegraDeNegocio('Não é possível desinscrever-se de um torneio finalizado.')
    inscricao.status = Inscricao.Status.CANCELADO
    inscricao.data_saida = timezone.now()
    inscricao.save(update_fields=['status', 'data_saida'])
    return inscricao


def reativar(inscricao: Inscricao) -> Inscricao:
    if inscricao.status == Inscricao.Status.INSCRITO:
        raise RegraDeNegocio('Esta inscrição já está ativa.')
    if inscricao.id_torneio.status == Torneio.Status.FINALIZADO:
        raise RegraDeNegocio('Não é possível reativar inscrições de jogadores em torneios finalizados.')
    validar_vaga(inscricao.id_torneio)
    inscricao.status = Inscricao.Status.INSCRITO
    inscricao.data_saida = None
    inscricao.save(update_fields=['status', 'data_saida'])
    return inscricao


def remover_inscricao(inscricao: Inscricao):
    """Exclusão definitiva: só antes do torneio começar. Depois disso, use desinscrever."""
    if inscricao.id_torneio.status != Torneio.Status.ABERTO:
        raise RegraDeNegocio('Só é possível excluir inscrições de torneios abertos. Use a desinscrição.')
    inscricao.delete()
