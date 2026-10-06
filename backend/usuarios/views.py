from django.contrib.auth import authenticate, login, logout
from django.shortcuts import get_object_or_404
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import servicos
from .models import Usuario
from .permissoes import IsProprioUsuarioOuAdmin
from .serializers import (
    AlterarSenhaSerializer,
    LoginSerializer,
    RequisitarTrocaSenhaSerializer,
    UsuarioCreateSerializer,
    UsuarioSerializer,
    ValidarTokenRedefinirSenhaSerializer,
    buscar_por_email,
)


class LoginView(APIView):
    """Autentica por e-mail e senha e abre a sessão (cookie)."""

    permission_classes = [AllowAny]
    throttle_scope = 'autenticacao'

    @swagger_auto_schema(request_body=LoginSerializer, responses={200: UsuarioSerializer})
    def post(self, request):
        dados = LoginSerializer(data=request.data)
        dados.is_valid(raise_exception=True)

        cadastrado = buscar_por_email(dados.validated_data['email'])
        usuario = (
            authenticate(request, username=cadastrado.email, password=dados.validated_data['password'])
            if cadastrado
            else None
        )
        if usuario is None:
            return Response({'detail': 'Credenciais inválidas'}, status=status.HTTP_401_UNAUTHORIZED)

        login(request, usuario)
        return Response({'message': 'Login realizado com sucesso', 'dados': UsuarioSerializer(usuario).data})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(request_body=None)
    def post(self, request):
        logout(request)
        return Response({'message': 'Logout realizado com sucesso'})


class ValidarSessaoView(APIView):
    """Dados do usuário logado (200) ou 204 se não há sessão — evita que o front trate 'sem sessão' como erro."""

    permission_classes = [AllowAny]

    @swagger_auto_schema(responses={200: UsuarioSerializer, 204: 'Nenhuma sessão ativa.'})
    def get(self, request):
        if request.user.is_authenticated:
            return Response(UsuarioSerializer(request.user).data)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RequisitarTrocaSenhaView(APIView):
    """Envia por e-mail um token de redefinição de senha (válido por 30 minutos)."""

    permission_classes = [AllowAny]
    throttle_scope = 'autenticacao'

    @swagger_auto_schema(request_body=RequisitarTrocaSenhaSerializer)
    def post(self, request):
        dados = RequisitarTrocaSenhaSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        usuario = dados.validated_data['usuario']
        servicos.enviar_token_redefinicao(usuario)
        return Response({'message': f'Token enviado para o email {usuario.email} com sucesso.'})


class ValidarTokenRedefinirSenhaView(APIView):
    """Com um token válido, gera uma nova senha e envia por e-mail."""

    permission_classes = [AllowAny]
    throttle_scope = 'autenticacao'

    @swagger_auto_schema(request_body=ValidarTokenRedefinirSenhaSerializer)
    def post(self, request):
        dados = ValidarTokenRedefinirSenhaSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        usuario = dados.validated_data['usuario']
        servicos.redefinir_senha_com_token(usuario)
        return Response(
            {'message': f'Senha redefinida com sucesso. Verifique seu email {usuario.email} para obter a nova senha.'}
        )


class AlterarSenhaView(APIView):
    """Troca de senha pelo próprio usuário (ou por um admin)."""

    permission_classes = [IsProprioUsuarioOuAdmin]

    @swagger_auto_schema(request_body=AlterarSenhaSerializer)
    def post(self, request, user_id):
        usuario = get_object_or_404(Usuario, id=user_id)
        self.check_object_permissions(request, usuario)

        dados = AlterarSenhaSerializer(data=request.data, context={'usuario': usuario})
        dados.is_valid(raise_exception=True)
        usuario.set_password(dados.validated_data['nova_senha'])
        usuario.save(update_fields=['password'])
        return Response({'message': 'Senha alterada com sucesso.'})


class UsuariosViewSet(viewsets.ModelViewSet):
    """
    Usuários.

    - Cadastro (POST): público.
    - Listagem: ADMIN vê todos; os demais veem só o próprio perfil.
    - Detalhe/edição/exclusão: o próprio usuário ou um ADMIN.
    """

    def get_queryset(self):
        usuario = self.request.user
        if self.action == 'list' and usuario.tipo != 'ADMIN':
            return Usuario.objects.filter(id=usuario.id)
        return Usuario.objects.all()

    def get_serializer_class(self):
        return UsuarioCreateSerializer if self.action == 'create' else UsuarioSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsProprioUsuarioOuAdmin()]
