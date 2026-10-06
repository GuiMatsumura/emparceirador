from django.shortcuts import get_object_or_404
from drf_yasg.utils import swagger_auto_schema
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from usuarios.models import Usuario

from .. import servicos
from ..models import Inscricao, Torneio
from ..permissoes import IsLojaOuAdmin
from ..serializers import (
    InscreverPorEmailSerializer,
    InscricaoCreateSerializer,
    InscricaoLojaSerializer,
    InscricaoRespostaSerializer,
    InscricaoSerializer,
)


class InscricaoViewSet(viewsets.ModelViewSet):
    """
    Inscrições em torneios (filtro opcional ?id_torneio=).

    - JOGADOR: vê, cria e edita (decklist) as próprias inscrições.
    - LOJA: vê e gerencia as inscrições dos seus torneios.
    - ADMIN: tudo.

    DELETE só é permitido antes do torneio começar; depois disso, use /desinscrever/.
    """

    http_method_names = ['get', 'post', 'put', 'delete', 'head', 'options']
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Inscricao.objects.select_related('id_usuario', 'id_torneio')
        torneio_id = self.request.query_params.get('id_torneio')
        if torneio_id:
            queryset = queryset.filter(id_torneio_id=torneio_id)

        usuario = self.request.user
        if usuario.tipo == 'ADMIN':
            return queryset
        if usuario.tipo == 'LOJA':
            return queryset.filter(id_torneio__id_loja=usuario)
        return queryset.filter(id_usuario=usuario)

    def get_serializer_class(self):
        if self.action == 'create':
            return InscricaoCreateSerializer if self.request.user.tipo == 'JOGADOR' else InscricaoLojaSerializer
        return InscricaoSerializer

    def perform_create(self, serializer):
        if self.request.user.tipo == 'JOGADOR':
            serializer.save(id_usuario=self.request.user)
        else:
            serializer.save()

    @swagger_auto_schema(responses={201: InscricaoRespostaSerializer})
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            {'message': 'Inscrição realizada com sucesso', 'inscricao': InscricaoSerializer(serializer.instance).data},
            status=status.HTTP_201_CREATED,
        )

    def perform_destroy(self, instance):
        servicos.remover_inscricao(instance)

    @swagger_auto_schema(request_body=None, responses={200: InscricaoRespostaSerializer})
    @action(detail=True, methods=['post'])
    def desinscrever(self, request, pk=None):
        """Saída do torneio (soft delete). A pontuação já obtida continua no histórico."""
        inscricao = servicos.desinscrever(self.get_object())
        return Response(
            {'message': 'Desinscrição realizada com sucesso.', 'inscricao': InscricaoSerializer(inscricao).data}
        )

    @swagger_auto_schema(request_body=None, responses={200: InscricaoRespostaSerializer})
    @action(detail=True, methods=['post'], permission_classes=[IsLojaOuAdmin])
    def reativar(self, request, pk=None):
        """Reinscreve um jogador que tinha saído (apenas loja dona do torneio ou admin)."""
        inscricao = servicos.reativar(self.get_object())
        return Response(
            {'message': 'Inscrição reativada com sucesso.', 'inscricao': InscricaoSerializer(inscricao).data}
        )

    @swagger_auto_schema(request_body=InscreverPorEmailSerializer, responses={201: InscricaoRespostaSerializer})
    @action(detail=False, methods=['post'], permission_classes=[IsLojaOuAdmin])
    def inscrever_por_email(self, request):
        """Loja inscreve um jogador já cadastrado informando o e-mail (no início ou entre rodadas)."""
        dados = InscreverPorEmailSerializer(data=request.data)
        dados.is_valid(raise_exception=True)

        torneio = get_object_or_404(Torneio, id=dados.validated_data['torneio_id'])
        if request.user.tipo != 'ADMIN' and torneio.id_loja_id != request.user.id:
            raise PermissionDenied('Acesso negado a este torneio')

        email = dados.validated_data['email']
        usuario = Usuario.objects.filter(email__iexact=email, tipo=Usuario.TipoUsuario.JOGADOR).first()
        if usuario is None:
            raise NotFound(f'Nenhum jogador encontrado com o email {email}')

        serializer = InscricaoLojaSerializer(
            data={'id_usuario': usuario.id, 'id_torneio': torneio.id}, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        inscricao = serializer.save()
        return Response(
            {
                'message': f'Jogador {usuario.username} inscrito com sucesso no torneio',
                'inscricao': InscricaoSerializer(inscricao).data,
            },
            status=status.HTTP_201_CREATED,
        )
