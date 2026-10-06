from rest_framework.permissions import BasePermission


class IsProprioUsuarioOuAdmin(BasePermission):
    """Acesso a um usuário apenas por ele mesmo ou por um ADMIN (verificação no nível de objeto)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return request.user.tipo == 'ADMIN' or obj == request.user
