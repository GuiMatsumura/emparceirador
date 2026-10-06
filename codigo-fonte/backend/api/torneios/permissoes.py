from rest_framework.permissions import BasePermission, SAFE_METHODS
from rest_framework import permissions
from .models import MesaJogador

class IsAdmin(BasePermission):
    """
    Permite acesso apenas a usuários com tipo 'ADMIN'.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.tipo == 'ADMIN')


class IsLoja(BasePermission):
    """
    Permite acesso apenas a usuários com tipo 'LOJA'.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.tipo == 'LOJA')


class IsJogador(BasePermission):
    """
    Permite acesso apenas a usuários com tipo 'JOGADOR'.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.tipo == 'JOGADOR')


class IsLojaOuAdmin(BasePermission):
    """
    Permite acesso a usuários do tipo 'LOJA' ou 'ADMIN'.
    Ideal para ações de gerenciamento de torneios.
    """

    def has_permission(self, request, view):
        # PRIMEIRO verifica se está autenticado
        if not request.user.is_authenticated:
            return False

        # DEPOIS verifica o tipo do usuário
        return request.user.tipo in ['LOJA', 'ADMIN']


class IsApenasLeitura(BasePermission):
    """
    Permite acesso irrestrito, mas apenas para métodos de leitura seguros
    (GET, HEAD, OPTIONS). Usado para que todos possam ver os dados públicos.
    """

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS


class IsOwnerOrAdmin(BasePermission):
    """
    Permissão que concede acesso se:
    1. O usuário for ADMIN (acesso total)
    2. O usuário for o DONO do objeto (acesso ao próprio recurso)

    Usada para operações em objetos específicos onde apenas o proprietário
    ou administradores devem ter acesso.
    """

    def has_permission(self, request, view):
        """
        Verificação inicial de permissão no nível da view.
        Retorna True para permitir que a verificação específica do objeto seja realizada.
        """
        # Permite que a verificação prossiga para o nível do objeto
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        """
        Verificação específica de permissão no nível do objeto.
        Determina se o usuário atual tem acesso ao objeto específico.

        Args:
            request: HttpRequest object
            view: Viewset ou APIView
            obj: Instância do modelo sendo acessada

        Returns:
            bool: True se usuário for admin ou dono do objeto, False caso contrário
        """
        # ADMIN tem acesso a tudo
        if request.user.tipo == 'ADMIN':
            return True

        # Usuário comum só acessa seus próprios recursos
        return obj == request.user


class IsJogadorNaMesa(permissions.BasePermission):
    """
    Permissão para jogadores que estão na mesa específica.

    ATENÇÃO: a verificação da mesa é feita em has_object_permission, então a view
    precisa chamar self.check_object_permissions(request, mesa) (ou usar get_object()).
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        return MesaJogador.objects.filter(
            id_mesa=obj,
            id_usuario=request.user
        ).exists()


def torneio_do_objeto(obj):
    """Retorna o Torneio ao qual um Torneio/Rodada/Mesa/Inscricao pertence."""
    if hasattr(obj, 'id_loja'):  # Torneio
        return obj
    if hasattr(obj, 'id_rodada'):  # Mesa
        return obj.id_rodada.id_torneio
    return obj.id_torneio  # Rodada, Inscricao


class IsDonoDoTorneioOuAdmin(BasePermission):
    """
    Em métodos de escrita, permite apenas o ADMIN ou a LOJA dona do torneio ao qual
    o objeto (Torneio, Rodada, Mesa ou Inscricao) pertence. Leitura é liberada aqui
    (as demais permissões da view decidem sobre leitura).
    """

    def has_permission(self, request, view):
        return True

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if not request.user.is_authenticated:
            return False
        if request.user.tipo == 'ADMIN':
            return True
        return torneio_do_objeto(obj).id_loja_id == request.user.id