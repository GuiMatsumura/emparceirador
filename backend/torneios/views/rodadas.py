from django.shortcuts import get_object_or_404
from drf_yasg.utils import swagger_auto_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from usuarios.models import Usuario

from .. import servicos
from ..emparelhamento import jogadores_ativos_ids
from ..models import Mesa, MesaJogador, Rodada
from ..permissoes import PERMISSOES_GESTAO, IsApenasLeitura, IsDonoDoTorneioOuAdmin, IsLojaOuAdmin
from ..serializers import (
    EditarEmparelhamentoSerializer,
    EmparelhamentoAutomaticoSerializer,
    IniciarRodadaSerializer,
    PosicionarJogadorSerializer,
    RodadaSerializer,
)


class RodadaViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Rodadas de um torneio (filtro ?torneio_id=). Leitura pública.

    Rodadas são criadas pelas ações do torneio (iniciar/proxima_rodada); aqui ficam as ações
    da fase de emparelhamento, restritas à loja dona do torneio ou admin.
    """

    serializer_class = RodadaSerializer
    permission_classes = [IsLojaOuAdmin | IsApenasLeitura, IsDonoDoTorneioOuAdmin]

    def get_queryset(self):
        queryset = Rodada.objects.select_related('id_torneio')
        torneio_id = self.request.query_params.get('torneio_id')
        if torneio_id:
            queryset = queryset.filter(id_torneio_id=torneio_id)
        return queryset.order_by('numero_rodada')

    @action(detail=True, methods=['get'], permission_classes=[IsLojaOuAdmin | IsApenasLeitura])
    def sobressalentes(self, request, pk=None):
        """Jogadores ativos que não estão em nenhuma mesa desta rodada (bye)."""
        rodada = self.get_object()
        em_mesas = MesaJogador.objects.filter(id_mesa__id_rodada=rodada).values_list('id_usuario_id', flat=True)
        ids = set(jogadores_ativos_ids(rodada.id_torneio)) - set(em_mesas)
        return Response(list(Usuario.objects.filter(id__in=ids).values('id', 'username', 'email')))

    @swagger_auto_schema(request_body=EmparelhamentoAutomaticoSerializer)
    @action(detail=True, methods=['post'], permission_classes=PERMISSOES_GESTAO)
    def emparelhar_automatico(self, request, pk=None):
        """Substitui o emparelhamento da rodada por um novo ('random' ou 'swiss')."""
        rodada = self.get_object()
        dados = EmparelhamentoAutomaticoSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        tipo = dados.validated_data['tipo']
        mesas = servicos.emparelhar_rodada(rodada, tipo)
        return Response(
            {
                'message': f'Emparelhamento automático ({tipo}) realizado',
                'mesas_criadas': mesas,
                'total_jogadores': len(jogadores_ativos_ids(rodada.id_torneio)),
            }
        )

    @action(detail=True, methods=['post'], permission_classes=PERMISSOES_GESTAO)
    def reemparelhar(self, request, pk=None):
        """Descarta o emparelhamento atual e refaz pelo sistema Swiss."""
        rodada = self.get_object()
        mesas = servicos.emparelhar_rodada(rodada, 'swiss')
        return Response(
            {
                'message': f'Emparelhamento resetado e re-executado automaticamente. {mesas} mesa(s) criada(s).',
                'rodada_id': rodada.id,
                'mesas_criadas': mesas,
            }
        )

    @swagger_auto_schema(request_body=EditarEmparelhamentoSerializer)
    @action(detail=True, methods=['post'], permission_classes=PERMISSOES_GESTAO)
    def editar_emparelhamento(self, request, pk=None):
        """Move um jogador para outra mesa ou troca o time dele."""
        rodada = self.get_object()
        dados = EditarEmparelhamentoSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        acao = dados.validated_data['acao']
        jogador_id = dados.validated_data['jogador_id']
        if acao == 'mover_jogador_para_mesa':
            servicos.mover_jogador_para_mesa(rodada, jogador_id, dados.validated_data['nova_mesa_id'])
        else:
            servicos.alterar_time_jogador(rodada, jogador_id, dados.validated_data['novo_time'])
        return Response({'message': f'Ação {acao} realizada com sucesso', 'jogador_id': jogador_id})

    @swagger_auto_schema(request_body=PosicionarJogadorSerializer)
    @action(detail=False, methods=['post'], permission_classes=PERMISSOES_GESTAO)
    def alterar_jogador_mesa(self, request):
        """Coloca um jogador numa posição de um time da mesa (jogador_id=0 esvazia a posição)."""
        dados = PosicionarJogadorSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        mesa = get_object_or_404(
            Mesa.objects.select_related('id_rodada__id_torneio'), id=dados.validated_data['mesa_id']
        )
        self.check_object_permissions(request, mesa)
        mensagem = servicos.posicionar_jogador(
            mesa,
            time=dados.validated_data['time'],
            posicao=dados.validated_data['position'],
            jogador_id=dados.validated_data['jogador_id'] or None,
        )
        return Response({'message': mensagem})

    @swagger_auto_schema(request_body=IniciarRodadaSerializer)
    @action(detail=True, methods=['post'], permission_classes=PERMISSOES_GESTAO)
    def iniciar_rodada(self, request, pk=None):
        """Encerra a fase de emparelhamento: a rodada fica 'Em Andamento' e os jogadores podem reportar."""
        rodada = self.get_object()
        dados = IniciarRodadaSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        mesas = servicos.iniciar_rodada(rodada, dados.validated_data['forcar_inicio'])
        return Response(
            {
                'message': 'Rodada iniciada com sucesso. Jogadores podem agora reportar resultados das mesas.',
                'mesas_criadas': mesas,
            }
        )
