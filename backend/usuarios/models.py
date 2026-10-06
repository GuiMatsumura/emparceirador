from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class GerenciadorUsuario(UserManager):
    """Login é por e-mail: o username vira opcional (padrão = e-mail) e superusuários são ADMIN."""

    def _create_user(self, username, email, password, **extra_fields):
        return super()._create_user(username or email, email, password, **extra_fields)

    def create_user(self, email=None, password=None, username=None, **extra_fields):
        return super().create_user(username, email, password, **extra_fields)

    def create_superuser(self, email=None, password=None, username=None, **extra_fields):
        extra_fields.setdefault('tipo', Usuario.TipoUsuario.ADMIN)
        return super().create_superuser(username, email, password, **extra_fields)


class Usuario(AbstractUser):
    """Usuário da plataforma. Faz login com e-mail; o `tipo` define as permissões."""

    class TipoUsuario(models.TextChoices):
        JOGADOR = 'JOGADOR', 'Jogador'
        LOJA = 'LOJA', 'Loja'
        ADMIN = 'ADMIN', 'Admin'

    tipo = models.CharField(max_length=10, choices=TipoUsuario.choices)
    status = models.CharField(max_length=100, default='ativo', help_text='Ex: ativo, inativo, banido.')
    email = models.EmailField(unique=True)

    token_redefinir_senha = models.CharField(max_length=16, blank=True, default='')
    token_redefinir_senha_criado_em = models.DateTimeField(blank=True, null=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    objects = GerenciadorUsuario()

    def __str__(self):
        return self.email
