from datetime import timedelta

from django.db.models import Case, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters import rest_framework as filters
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .. import servicos
from ..excecoes import RegraDeNegocio
from ..models import Rodada, Torneio
from ..permissoes import IsApenasLeitura, IsLojaOuAdmin
from ..ranking import ranking_da_rodada
from ..serializers import RodadaSerializer, TorneioSerializer

# Torneios "Aberto" continuam na listagem até 1h depois do horário marcado (atrasos e inscrições de última hora)
TOLERANCIA_INICIO = timedelta(hours=1)


class TorneioFilter(filters.FilterSet):
    status = filters.CharFilter(method='filtrar_status', help_text='Um ou mais status separados por vírgula.')

    class Meta:
        model = Torneio
        fields = ['status']

    def filtrar_status(self, queryset, name, value):
        return queryset.filter(status__in=[s.strip() for s in value.split(',')])


class TorneioViewSet(viewsets.ModelViewSet):
    """
    Torneios. Leitura pública; criação/edição por LOJA (somente os seus) ou ADMIN.

    Ordenação: Em Andamento, depois Aberto, depois os demais; dentro de cada grupo, por data de início.
    """

    serializer_class = TorneioSerializer
    http_method_names = ['get', 'post', 'put', 'delete', 'head', 'options']
    permission_classes = [IsLojaOuAdmin | IsApenasLeitura]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_class = TorneioFilter

    def get_queryset(self):
        queryset = (
            Torneio.objects.select_related('id_loja')
            .annotate(
                prioridade=Case(
                    When(status=Torneio.Status.EM_ANDAMENTO, then=Value(1)),
                    When(status=Torneio.Status.ABERTO, then=Value(2)),
                    default=Value(3),
                    output_field=IntegerField(),
                )
            )
            .order_by('prioridade', 'data_inicio')
        )
        if self.action == 'list':
            limite = timezone.now() - TOLERANCIA_INICIO
            queryset = queryset.exclude(Q(status=Torneio.Status.ABERTO) & Q(data_inicio__lt=limite))

        usuario = self.request.user
        if usuario.is_authenticated and usuario.tipo == 'LOJA':
            queryset = queryset.filter(id_loja=usuario)
        return queryset

    def perform_create(self, serializer):
        self._salvar_com_loja(serializer)

    def perform_update(self, serializer):
        self._salvar_com_loja(serializer)

    def _salvar_com_loja(self, serializer):
        """LOJA sempre fica como dona do próprio torneio; ADMIN informa id_loja."""
        if self.request.user.tipo == 'LOJA':
            serializer.save(id_loja=self.request.user)
        else:
            serializer.save()

    @swagger_auto_schema(
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT, properties={'confirmacao': openapi.Schema(type=openapi.TYPE_BOOLEAN)}
        )
    )
    @action(detail=True, methods=['post'], permission_classes=[IsLojaOuAdmin])
    def cancelar(self, request, pk=None):
        """Cancela um torneio aberto (exige confirmacao=true). Os dados são mantidos para histórico."""
        torneio = self.get_object()
        if not request.data.get('confirmacao'):
            raise RegraDeNegocio('Envie confirmacao: true para confirmar o cancelamento')
        servicos.cancelar_torneio(torneio)
        return Response(
            {
                'message': 'Torneio cancelado com sucesso. Todos os dados foram mantidos para histórico.',
                'torneio': TorneioSerializer(torneio).data,
            }
        )

    @action(detail=True, methods=['post'], permission_classes=[IsLojaOuAdmin])
    def iniciar(self, request, pk=None):
        """Inicia o torneio: cria a Rodada 1 (já em andamento) com emparelhamento aleatório."""
        resultado = servicos.iniciar_torneio(self.get_object())
        mensagem = f'Torneio iniciado com sucesso. {resultado.mesas_criadas} mesa(s) criada(s).'
        if resultado.jogadores_com_bye:
            mensagem += f' {resultado.jogadores_com_bye} jogador(es) recebeu(ram) bye nesta rodada.'
        return Response(
            {
                'message': mensagem,
                'rodada': RodadaSerializer(resultado.rodada).data,
                'mesas_criadas': resultado.mesas_criadas,
                'total_jogadores': resultado.total_jogadores,
            }
        )

    @action(detail=True, methods=['post'], permission_classes=[IsLojaOuAdmin])
    def proxima_rodada(self, request, pk=None):
        """Encerra a rodada atual (todas as mesas com resultado) e cria a próxima já emparelhada (Swiss)."""
        resultado = servicos.avancar_rodada(self.get_object())
        return Response(
            {
                'message': (
                    f'Rodada {resultado.rodada_anterior.numero_rodada} finalizada. '
                    f'Nova rodada {resultado.nova_rodada.numero_rodada} criada com '
                    f'{resultado.mesas_criadas} mesa(s) emparelhada(s) automaticamente.'
                ),
                'rodada_anterior': RodadaSerializer(resultado.rodada_anterior).data,
                'nova_rodada': RodadaSerializer(resultado.nova_rodada).data,
            }
        )

    @action(detail=True, methods=['post'], permission_classes=[IsLojaOuAdmin])
    def finalizar(self, request, pk=None):
        """Finaliza o torneio e devolve o ranking final."""
        resultado = servicos.finalizar_torneio(self.get_object())
        return Response(
            {
                'message': 'Torneio finalizado com sucesso',
                'ranking': resultado.ranking,
                'total_rodadas': resultado.total_rodadas,
            }
        )

    @swagger_auto_schema(
        manual_parameters=[openapi.Parameter('rodada_id', openapi.IN_QUERY, type=openapi.TYPE_INTEGER, required=True)]
    )
    @action(detail=True, methods=['get'], permission_classes=[IsLojaOuAdmin | IsApenasLeitura])
    def ranking_rodada(self, request, pk=None):
        """Ranking acumulado até a rodada informada (com métricas de desempate se a rodada já terminou)."""
        torneio = self.get_object()
        rodada_id = request.query_params.get('rodada_id')
        if not rodada_id:
            return Response({'detail': "Parâmetro 'rodada_id' é obrigatório"}, status=status.HTTP_400_BAD_REQUEST)
        rodada = get_object_or_404(Rodada, id=rodada_id, id_torneio=torneio)
        return Response({'rodada_numero': rodada.numero_rodada, 'ranking': ranking_da_rodada(torneio, rodada)})
