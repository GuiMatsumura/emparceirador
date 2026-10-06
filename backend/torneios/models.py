from django.conf import settings
from django.db import models


class Torneio(models.Model):
    """Torneio criado e gerenciado por um usuário do tipo LOJA."""

    class Status(models.TextChoices):
        ABERTO = 'Aberto'
        EM_ANDAMENTO = 'Em Andamento'
        FINALIZADO = 'Finalizado'
        CANCELADO = 'Cancelado'

    id_loja = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='torneios_criados',
        help_text='Usuário (loja) que criou o torneio.',
    )
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, default='')
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.ABERTO)
    regras = models.TextField()
    banner = models.CharField(
        max_length=255, blank=True, default='', help_text='Nome do arquivo do banner no frontend (ex: b1.png).'
    )
    vagas_limitadas = models.BooleanField(default=True)
    qnt_vagas = models.PositiveIntegerField(blank=True, null=True)
    inscricao_gratuita = models.BooleanField(default=True)
    valor_inscricao = models.DecimalField(
        max_digits=10, decimal_places=2, blank=True, null=True, help_text='Valor da inscrição em reais.'
    )
    pontuacao_vitoria = models.PositiveIntegerField(default=3)
    pontuacao_derrota = models.PositiveIntegerField(default=0)
    pontuacao_empate = models.PositiveIntegerField(default=1)
    pontuacao_bye = models.PositiveIntegerField(default=3)
    quantidade_rodadas = models.PositiveIntegerField(
        blank=True, null=True, help_text='Limite de rodadas. Vazio = sem limite.'
    )
    data_inicio = models.DateTimeField()

    def __str__(self):
        return self.nome


class InscricaoQuerySet(models.QuerySet):
    def ativas(self):
        """Inscrições que participam do torneio. Fonte única do critério de 'jogador ativo'."""
        return self.filter(status=Inscricao.Status.INSCRITO)


class Inscricao(models.Model):
    """Inscrição de um jogador em um torneio. Saída é soft delete (status Cancelado + data_saida)."""

    class Status(models.TextChoices):
        INSCRITO = 'Inscrito'
        CANCELADO = 'Cancelado'

    id_usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='inscricoes')
    id_torneio = models.ForeignKey(Torneio, on_delete=models.CASCADE, related_name='inscritos')
    decklist = models.TextField(blank=True)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.INSCRITO)
    data_inscricao = models.DateTimeField(auto_now_add=True)
    data_saida = models.DateTimeField(null=True, blank=True)

    objects = InscricaoQuerySet.as_manager()

    class Meta:
        unique_together = ('id_usuario', 'id_torneio')

    def __str__(self):
        return f'{self.id_usuario.username} no {self.id_torneio.nome}'


class Rodada(models.Model):
    """
    Rodada de um torneio.

    Ciclo: Emparelhamento -> Em Andamento -> Finalizada. A Rodada 1 nasce Em Andamento.
    """

    class Status(models.TextChoices):
        EMPARELHAMENTO = 'Emparelhamento'
        EM_ANDAMENTO = 'Em Andamento'
        FINALIZADA = 'Finalizada'

    id_torneio = models.ForeignKey(Torneio, on_delete=models.CASCADE, related_name='rodadas')
    numero_rodada = models.IntegerField()
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.EMPARELHAMENTO)
    data_inicio = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Momento em que a rodada passou para 'Em Andamento'. Usado para saber quem estava inscrito "
        'na rodada (bye). Nulo em rodadas antigas.',
    )

    class Meta:
        unique_together = ('id_torneio', 'numero_rodada')

    def __str__(self):
        return f'Rodada {self.numero_rodada} do {self.id_torneio.nome}'


class Mesa(models.Model):
    """Mesa 2v2 de uma rodada."""

    class Resultado(models.IntegerChoices):
        EMPATE = 0
        TIME_1 = 1
        TIME_2 = 2

    id_rodada = models.ForeignKey(Rodada, on_delete=models.CASCADE, related_name='mesas')
    numero_mesa = models.IntegerField()
    time_vencedor = models.IntegerField(
        choices=Resultado.choices, null=True, blank=True, help_text='Nulo enquanto o resultado não foi reportado.'
    )
    pontuacao_time_1 = models.IntegerField(default=0)
    pontuacao_time_2 = models.IntegerField(default=0)

    def __str__(self):
        return f'Mesa {self.numero_mesa} da {self.id_rodada}'


class MesaJogador(models.Model):
    """Aloca um jogador a uma mesa e a um time (1 ou 2)."""

    id_mesa = models.ForeignKey(Mesa, on_delete=models.CASCADE, related_name='jogadores_na_mesa')
    id_usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    time = models.IntegerField(choices=[(1, 'Time 1'), (2, 'Time 2')])

    class Meta:
        unique_together = ('id_mesa', 'id_usuario')
        indexes = [
            models.Index(fields=['id_usuario', 'id_mesa'], name='jogador_mesa_idx'),
        ]

    def __str__(self):
        return f'{self.id_usuario.username} na {self.id_mesa} (Time {self.time})'


class RankingParcial(models.Model):
    """Ranking de um jogador calculado ao final de uma rodada (cache das métricas de desempate)."""

    id_torneio = models.ForeignKey(Torneio, on_delete=models.CASCADE, related_name='rankings_parciais')
    id_usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='rankings')
    rodada_numero = models.IntegerField(help_text='Até qual rodada foi calculado.')

    pontos_totais = models.IntegerField(default=0)
    mw_percentage = models.DecimalField(max_digits=5, decimal_places=4, help_text='Match Win % (piso de 1%).')
    omw_percentage = models.DecimalField(max_digits=5, decimal_places=4, help_text='Média do MW% dos oponentes.')
    pmw_percentage = models.DecimalField(max_digits=5, decimal_places=4, help_text='Média do MW% dos parceiros.')
    balanco = models.DecimalField(max_digits=6, decimal_places=4, help_text='OMW% - PMW% (pode ser negativo).')
    posicao = models.IntegerField()
    data_calculo = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('id_torneio', 'id_usuario', 'rodada_numero')
        ordering = ['id_torneio', 'rodada_numero', 'posicao']
        indexes = [
            models.Index(fields=['id_torneio', 'rodada_numero'], name='torneio_rodada_idx'),
            models.Index(fields=['id_torneio', 'rodada_numero', 'posicao'], name='ranking_lookup_idx'),
        ]

    def __str__(self):
        return f'{self.id_usuario.username} - {self.posicao}º (Rodada {self.rodada_numero} - {self.id_torneio.nome})'
