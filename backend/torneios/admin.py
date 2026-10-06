from django.contrib import admin

from .models import Inscricao, Mesa, MesaJogador, RankingParcial, Rodada, Torneio


class InscricaoInline(admin.TabularInline):
    model = Inscricao
    extra = 0
    raw_id_fields = ['id_usuario']


class RodadaInline(admin.TabularInline):
    model = Rodada
    extra = 0
    show_change_link = True


@admin.register(Torneio)
class TorneioAdmin(admin.ModelAdmin):
    list_display = ['nome', 'id_loja', 'status', 'data_inicio']
    list_filter = ['status']
    search_fields = ['nome', 'id_loja__email']
    inlines = [InscricaoInline, RodadaInline]


class MesaJogadorInline(admin.TabularInline):
    model = MesaJogador
    extra = 0
    raw_id_fields = ['id_usuario']


@admin.register(Mesa)
class MesaAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'time_vencedor', 'pontuacao_time_1', 'pontuacao_time_2']
    list_filter = ['id_rodada__id_torneio']
    inlines = [MesaJogadorInline]


@admin.register(Rodada)
class RodadaAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'status', 'data_inicio']
    list_filter = ['status']


@admin.register(Inscricao)
class InscricaoAdmin(admin.ModelAdmin):
    list_display = ['id_usuario', 'id_torneio', 'status', 'data_inscricao']
    list_filter = ['status']
    search_fields = ['id_usuario__email', 'id_torneio__nome']


@admin.register(RankingParcial)
class RankingParcialAdmin(admin.ModelAdmin):
    list_display = ['id_torneio', 'rodada_numero', 'posicao', 'id_usuario', 'pontos_totais', 'balanco']
    list_filter = ['id_torneio']
