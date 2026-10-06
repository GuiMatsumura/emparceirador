from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .. import servicos
from ..models import Mesa, MesaJogador
from ..permissoes import PERMISSOES_GESTAO, IsApenasLeitura, IsDonoDoTorneioOuAdmin, IsJogadorNaMesa, IsLojaOuAdmin
from ..serializers import MesaDetailSerializer, ResultadoMesaSerializer, VisualizacaoMesaJogadorSerializer


class MesaViewSet(viewsets.ReadOnlyModelViewSet):
    """Mesas com seus jogadores (filtro ?rodada_id=). Leitura pública."""

    serializer_class = MesaDetailSerializer
    permission_classes = [IsLojaOuAdmin | IsApenasLeitura, IsDonoDoTorneioOuAdmin]

    def get_queryset(self):
        queryset = Mesa.objects.select_related('id_rodada__id_torneio').prefetch_related(
            'jogadores_na_mesa__id_usuario'
        )
        rodada_id = self.request.query_params.get('rodada_id')
        if rodada_id:
            queryset = queryset.filter(id_rodada_id=rodada_id)
        return queryset.order_by('numero_mesa')

    def _responder_resultado(self, mensagem, mesa_id):
        mesa = self.get_queryset().get(pk=mesa_id)
        return Response({'message': mensagem, 'mesa': MesaDetailSerializer(mesa).data})

    @swagger_auto_schema(request_body=ResultadoMesaSerializer)
    @action(detail=True, methods=['post'], permission_classes=[IsJogadorNaMesa])
    def reportar_resultado(self, request, pk=None):
        """Jogador da mesa reporta o placar enquanto a rodada está em andamento."""
        mesa = self.get_object()
        dados = ResultadoMesaSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        servicos.reportar_resultado(mesa.id, **dados.validated_data)
        return self._responder_resultado('Resultado reportado com sucesso', mesa.id)

    @swagger_auto_schema(request_body=ResultadoMesaSerializer)
    @action(detail=True, methods=['patch'], permission_classes=PERMISSOES_GESTAO)
    def editar_manual(self, request, pk=None):
        """Loja corrige o placar de uma mesa (recalcula o ranking se a rodada já terminou)."""
        mesa = self.get_object()
        dados = ResultadoMesaSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        servicos.editar_resultado(mesa, **dados.validated_data)
        return self._responder_resultado('Mesa editada manualmente com sucesso', mesa.id)

    @swagger_auto_schema(
        manual_parameters=[openapi.Parameter('rodada_id', openapi.IN_QUERY, type=openapi.TYPE_INTEGER, required=True)]
    )
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def minha_mesa_na_rodada(self, request):
        """Mesa do jogador logado na rodada informada, com o time dele em 'meu_time'."""
        rodada_id = request.query_params.get('rodada_id')
        if not rodada_id:
            return Response({'error': "Parâmetro 'rodada_id' é obrigatório"}, status=status.HTTP_400_BAD_REQUEST)

        lugar = (
            MesaJogador.objects.select_related('id_mesa__id_rodada__id_torneio')
            .filter(id_usuario=request.user, id_mesa__id_rodada_id=rodada_id)
            .first()
        )
        if lugar is None:
            return Response(
                {'error': 'Jogador não está em nenhuma mesa desta rodada'}, status=status.HTTP_404_NOT_FOUND
            )

        mesa = self.get_queryset().get(pk=lugar.id_mesa_id)
        return Response({**VisualizacaoMesaJogadorSerializer(mesa).data, 'meu_time': lugar.time})
