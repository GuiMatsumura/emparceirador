from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import MesaJogador


class IsLojaOuAdmin(BasePermission):
    """Usuário autenticado do tipo LOJA ou ADMIN."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.tipo in ('LOJA', 'ADMIN'))


class IsApenasLeitura(BasePermission):
    """Libera apenas métodos de leitura (GET, HEAD, OPTIONS), inclusive para anônimos."""

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS


def torneio_do_objeto(obj):
    """Retorna o Torneio ao qual um Torneio/Rodada/Mesa/Inscricao pertence."""
    if hasattr(obj, 'id_loja'):  # Torneio
        return obj
    if hasattr(obj, 'id_rodada'):  # Mesa
        return obj.id_rodada.id_torneio
    return obj.id_torneio  # Rodada, Inscricao


class IsDonoDoTorneioOuAdmin(BasePermission):
    """
    Em métodos de escrita, só o ADMIN ou a LOJA dona do torneio ao qual o objeto pertence.

    Só tem efeito no nível de objeto: a view precisa usar get_object() (ou chamar
    check_object_permissions) para a verificação acontecer.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if not request.user.is_authenticated:
            return False
        if request.user.tipo == 'ADMIN':
            return True
        return torneio_do_objeto(obj).id_loja_id == request.user.id


class IsJogadorNaMesa(BasePermission):
    """
    Usuário autenticado que está sentado na mesa.

    Só tem efeito no nível de objeto: a view precisa chamar check_object_permissions(request, mesa).
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return MesaJogador.objects.filter(id_mesa=obj, id_usuario=request.user).exists()


# Ações de gestão: precisa ser LOJA/ADMIN e, se LOJA, dona do torneio do objeto.
PERMISSOES_GESTAO = [IsLojaOuAdmin, IsDonoDoTorneioOuAdmin]
