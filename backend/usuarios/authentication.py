from urllib.parse import urlsplit

from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import SAFE_METHODS


def _origem(url):
    """Normaliza 'https://site.com/caminho' -> 'https://site.com'."""
    partes = urlsplit(url)
    if not partes.scheme or not partes.netloc:
        return None
    return f'{partes.scheme}://{partes.netloc}'.lower()


class SessionAuthenticationPorOrigem(SessionAuthentication):
    """
    Autenticação por sessão com proteção CSRF baseada na origem da requisição.

    O frontend roda em outro domínio e o cookie de sessão usa SameSite=None, então o
    token CSRF tradicional do Django (cookie + header) não é viável entre domínios.
    Em vez disso, em métodos de escrita feitos por navegadores, exige que o cabeçalho
    Origin (ou, na falta dele, o Referer) pertença a uma origem permitida
    (CORS_ALLOWED_ORIGINS + CSRF_TRUSTED_ORIGINS) ou ao próprio host da API.

    Requisições sem Origin e sem Referer (scripts, testes, apps) não vêm de navegador
    e, portanto, não estão sujeitas a CSRF.
    """

    def enforce_csrf(self, request):
        if request.method in SAFE_METHODS:
            return

        cabecalho = request.META.get('HTTP_ORIGIN') or request.META.get('HTTP_REFERER')
        if not cabecalho:
            return

        origem = _origem(cabecalho)
        permitidas = {
            o.strip().lower().rstrip('/') for o in [*settings.CORS_ALLOWED_ORIGINS, *settings.CSRF_TRUSTED_ORIGINS]
        }
        permitidas.add(f'{request.scheme}://{request.get_host()}'.lower())

        if origem not in permitidas:
            raise exceptions.PermissionDenied('Origem da requisição não permitida.')
