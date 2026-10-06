from datetime import timedelta

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from .models import Usuario

VALIDADE_TOKEN_REDEFINIR_SENHA = timedelta(minutes=30)


def validar_forca_senha(senha, usuario=None):
    """Aplica os AUTH_PASSWORD_VALIDATORS do settings e converte o erro para o formato do DRF."""
    try:
        validate_password(senha, user=usuario)
    except DjangoValidationError as erro:
        raise serializers.ValidationError(list(erro.messages)) from erro
    return senha


def buscar_por_email(email):
    """E-mail é comparado sem diferenciar maiúsculas/minúsculas."""
    return Usuario.objects.filter(email__iexact=email).first()


class UsuarioSerializer(serializers.ModelSerializer):
    """Dados públicos do usuário (nunca inclui a senha)."""

    class Meta:
        model = Usuario
        fields = ['id', 'email', 'username', 'tipo', 'status', 'date_joined']
        read_only_fields = ['id', 'date_joined', 'tipo']


class UsuarioCreateSerializer(serializers.ModelSerializer):
    """Cadastro. A senha é validada e gravada com hash (create_user)."""

    class Meta:
        model = Usuario
        fields = ['id', 'email', 'username', 'tipo', 'password']
        extra_kwargs = {'password': {'write_only': True}, 'id': {'read_only': True}}

    def validate_email(self, value):
        if buscar_por_email(value):
            raise serializers.ValidationError('Já existe um usuário com este e-mail.')
        return value

    def validate_tipo(self, value):
        """Cadastro público só cria JOGADOR ou LOJA. Apenas um ADMIN logado pode criar outro ADMIN."""
        if value == Usuario.TipoUsuario.ADMIN:
            usuario_logado = getattr(self.context.get('request'), 'user', None)
            if not (usuario_logado and usuario_logado.is_authenticated and usuario_logado.tipo == 'ADMIN'):
                raise serializers.ValidationError('Não é permitido criar usuários do tipo ADMIN.')
        return value

    def validate(self, data):
        usuario_provisorio = Usuario(email=data.get('email'), username=data.get('username'))
        try:
            validar_forca_senha(data.get('password'), usuario_provisorio)
        except serializers.ValidationError as erro:
            raise serializers.ValidationError({'password': erro.detail}) from erro
        return data

    def create(self, validated_data):
        return Usuario.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)


class RequisitarTrocaSenhaSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate(self, data):
        usuario = buscar_por_email(data['email'])
        if not usuario:
            raise serializers.ValidationError({'email': 'Usuário com este email não foi encontrado.'})
        data['usuario'] = usuario
        return data


class ValidarTokenRedefinirSenhaSerializer(serializers.Serializer):
    email = serializers.EmailField()
    token = serializers.CharField(max_length=16)

    def validate(self, data):
        usuario = buscar_por_email(data['email'])
        if not usuario:
            raise serializers.ValidationError('Usuário com este email não foi encontrado.')

        criado_em = usuario.token_redefinir_senha_criado_em
        token_valido = (
            usuario.token_redefinir_senha
            and usuario.token_redefinir_senha == data['token']
            and criado_em
            and timezone.now() - criado_em <= VALIDADE_TOKEN_REDEFINIR_SENHA
        )
        if not token_valido:
            raise serializers.ValidationError('Token inválido ou expirado.')

        data['usuario'] = usuario
        return data


class AlterarSenhaSerializer(serializers.Serializer):
    """Troca de senha. O dono da senha vem em context['usuario'] (melhora a checagem de similaridade)."""

    senha_antiga = serializers.CharField(write_only=True, trim_whitespace=False)
    nova_senha = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, data):
        usuario = self.context['usuario']
        if not usuario.check_password(data['senha_antiga']):
            raise serializers.ValidationError({'senha_antiga': 'Senha antiga incorreta.'})
        if data['senha_antiga'] == data['nova_senha']:
            raise serializers.ValidationError('A nova senha não pode ser igual à senha antiga.')
        try:
            validar_forca_senha(data['nova_senha'], usuario)
        except serializers.ValidationError as erro:
            raise serializers.ValidationError({'nova_senha': erro.detail}) from erro
        return data
