from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import InscricaoViewSet, MesaViewSet, RodadaViewSet, TorneioViewSet

# O DefaultRouter do DRF cria automaticamente as URLs para as ViewSets.
# Ex: /torneios/ (GET, POST), /torneios/1/ (GET, PUT, DELETE)
# Isso padroniza a API e economiza muito trabalho manual.

# Basta registrar novas ViewSets aqui para expor novos endpoints.
router = DefaultRouter()
router.register(r'torneios', TorneioViewSet, basename='torneio')
router.register(r'inscricoes', InscricaoViewSet, basename='inscricao')
router.register(r'rodadas', RodadaViewSet, basename='rodada')
router.register(r'mesas', MesaViewSet, basename='mesa')

# As URLs da API são determinadas automaticamente pelo router.
urlpatterns = [
    path('', include(router.urls)),
]
