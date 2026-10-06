from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.crypto import get_random_string

from .models import Usuario


def _enviar_email(destinatario: str, assunto: str, template: str, contexto: dict, texto_puro: str):
    mensagem = EmailMultiAlternatives(
        subject=assunto, body=texto_puro, from_email=settings.DEFAULT_FROM_EMAIL, to=[destinatario]
    )
    mensagem.attach_alternative(render_to_string(template, contexto), 'text/html')
    mensagem.send()


def enviar_token_redefinicao(usuario: Usuario):
    """Gera um token de redefinição (válido por tempo limitado) e envia por e-mail."""
    token = get_random_string(length=16)
    usuario.token_redefinir_senha = token
    usuario.token_redefinir_senha_criado_em = timezone.now()
    usuario.save(update_fields=['token_redefinir_senha', 'token_redefinir_senha_criado_em'])

    _enviar_email(
        usuario.email,
        'Redefinição de senha - Commander150',
        'emails/token_redefinir_senha.html',
        {'token': token, 'nome': usuario.username},
        f'Seu token para redefinição de senha é: {token}',
    )


def redefinir_senha_com_token(usuario: Usuario):
    """Gera uma senha nova, invalida o token e envia a senha por e-mail."""
    nova_senha = get_random_string(length=12)
    usuario.set_password(nova_senha)
    usuario.token_redefinir_senha = ''
    usuario.token_redefinir_senha_criado_em = None
    usuario.save()

    _enviar_email(
        usuario.email,
        'Sua nova senha - Commander150',
        'emails/sucesso_redefinir_senha.html',
        {'nova_senha': nova_senha, 'nome': usuario.username},
        f'Sua nova senha é: {nova_senha}. Recomendamos alterá-la assim que possível.',
    )
