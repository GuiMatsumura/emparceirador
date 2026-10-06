from django.utils import timezone
from rest_framework import serializers

from .models import Inscricao, Mesa, MesaJogador, Rodada, Torneio
from .servicos import validar_vaga

# ------------------------------------------------------------------------------
# Torneio
# ------------------------------------------------------------------------------


class TorneioSerializer(serializers.ModelSerializer):
    loja_nome = serializers.CharField(source='id_loja.username', read_only=True)
    loja_email = serializers.CharField(source='id_loja.email', read_only=True)
    loja_tipo = serializers.CharField(source='id_loja.tipo', read_only=True)
    qnt_inscritos = serializers.SerializerMethodField(help_text='Inscrições ativas.')

    class Meta:
        model = Torneio
        fields = '__all__'
        # O status só muda pelas ações do torneio (iniciar, cancelar, finalizar...);
        # o dono é sempre quem criou o torneio.
        read_only_fields = ['status', 'id_loja']

    def get_qnt_inscritos(self, torneio) -> int:
        # Vem anotado pelo queryset da listagem; senão, conta.
        if hasattr(torneio, 'qnt_inscritos'):
            return torneio.qnt_inscritos
        return Inscricao.objects.ativas().filter(id_torneio=torneio).count()

    def validate_data_inicio(self, value):
        """A data de início não pode estar no passado (só checada quando ela muda)."""
        if self.instance and self.instance.data_inicio == value:
            return value
        if value < timezone.now():
            raise serializers.ValidationError('A data de início do torneio não pode estar no passado.')
        return value


# ------------------------------------------------------------------------------
# Inscrição
# ------------------------------------------------------------------------------


class InscricaoSerializer(serializers.ModelSerializer):
    """Leitura de inscrições. Na edição, só a decklist pode mudar (status muda por desinscrever/reativar)."""

    username = serializers.CharField(source='id_usuario.username', read_only=True)
    email = serializers.CharField(source='id_usuario.email', read_only=True)
    nome_torneio = serializers.CharField(source='id_torneio.nome', read_only=True)

    class Meta:
        model = Inscricao
        fields = ['id', 'id_usuario', 'username', 'email', 'id_torneio', 'nome_torneio', 'decklist', 'status',
                  'data_inscricao']  # fmt: skip
        read_only_fields = ['id', 'id_usuario', 'id_torneio', 'status', 'data_inscricao']


def _validar_nova_inscricao(usuario, torneio, *, pela_loja: bool):
    """Regras comuns para criar uma inscrição. Levanta ValidationError."""
    if pela_loja:
        if torneio.status not in (Torneio.Status.ABERTO, Torneio.Status.EM_ANDAMENTO):
            raise serializers.ValidationError(
                f'Só é possível inscrever jogadores em torneios abertos ou em andamento. Status atual: {torneio.status}'
            )
    else:
        if torneio.status != Torneio.Status.ABERTO:
            raise serializers.ValidationError(
                f'Jogadores só podem se inscrever em torneios abertos. Status atual: {torneio.status}'
            )
        if torneio.data_inicio < timezone.now():
            raise serializers.ValidationError('Não é possível se inscrever: a data de início do torneio já passou.')

    if usuario.tipo != 'JOGADOR':
        raise serializers.ValidationError('Apenas jogadores podem ser inscritos em torneios.')
    if Inscricao.objects.filter(id_usuario=usuario, id_torneio=torneio).exists():
        raise serializers.ValidationError(f'O jogador {usuario.username} já está inscrito neste torneio.')
    validar_vaga(torneio)


class InscricaoCreateSerializer(serializers.ModelSerializer):
    """Inscrição feita pelo próprio jogador."""

    class Meta:
        model = Inscricao
        fields = ['id_torneio', 'decklist']

    def validate(self, data):
        _validar_nova_inscricao(self.context['request'].user, data['id_torneio'], pela_loja=False)
        return data


class InscricaoLojaSerializer(serializers.ModelSerializer):
    """Inscrição de um jogador feita pela loja dona do torneio (ou admin)."""

    username = serializers.CharField(source='id_usuario.username', read_only=True)
    email = serializers.CharField(source='id_usuario.email', read_only=True)

    class Meta:
        model = Inscricao
        fields = ['id', 'id_usuario', 'username', 'email', 'id_torneio', 'decklist', 'status', 'data_inscricao']
        read_only_fields = ['id', 'status', 'data_inscricao']

    def validate(self, data):
        usuario_logado = self.context['request'].user
        torneio = data['id_torneio']
        if usuario_logado.tipo != 'ADMIN' and torneio.id_loja_id != usuario_logado.id:
            raise serializers.ValidationError('Você só pode gerenciar inscrições dos seus próprios torneios.')
        _validar_nova_inscricao(data['id_usuario'], torneio, pela_loja=True)
        return data


class InscreverPorEmailSerializer(serializers.Serializer):
    torneio_id = serializers.IntegerField()
    email = serializers.EmailField()


class InscricaoRespostaSerializer(serializers.Serializer):
    """Formato das respostas das ações de inscrição (documentação Swagger)."""

    message = serializers.CharField()
    inscricao = InscricaoSerializer()


# ------------------------------------------------------------------------------
# Rodada / mesa
# ------------------------------------------------------------------------------


class RodadaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rodada
        fields = '__all__'


class MesaJogadorSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='id_usuario.username', read_only=True)
    email = serializers.CharField(source='id_usuario.email', read_only=True)

    class Meta:
        model = MesaJogador
        fields = ['id', 'id_usuario', 'username', 'email', 'time']


class MesaDetailSerializer(serializers.ModelSerializer):
    jogadores = MesaJogadorSerializer(source='jogadores_na_mesa', many=True, read_only=True)
    numero_rodada = serializers.IntegerField(source='id_rodada.numero_rodada', read_only=True)
    nome_torneio = serializers.CharField(source='id_rodada.id_torneio.nome', read_only=True)

    class Meta:
        model = Mesa
        fields = ['id', 'id_rodada', 'numero_rodada', 'nome_torneio', 'numero_mesa', 'time_vencedor',
                  'pontuacao_time_1', 'pontuacao_time_2', 'jogadores']  # fmt: skip


class VisualizacaoMesaJogadorSerializer(serializers.ModelSerializer):
    """Mesa vista por um jogador: times separados."""

    id_torneio = serializers.IntegerField(source='id_rodada.id_torneio_id', read_only=True)
    nome_torneio = serializers.CharField(source='id_rodada.id_torneio.nome', read_only=True)
    numero_rodada = serializers.IntegerField(source='id_rodada.numero_rodada', read_only=True)
    status_rodada = serializers.CharField(source='id_rodada.status', read_only=True)
    time_1 = serializers.SerializerMethodField()
    time_2 = serializers.SerializerMethodField()

    class Meta:
        model = Mesa
        fields = ['id', 'numero_mesa', 'id_torneio', 'nome_torneio', 'numero_rodada', 'status_rodada',
                  'pontuacao_time_1', 'pontuacao_time_2', 'time_vencedor', 'time_1', 'time_2']  # fmt: skip

    def _jogadores_do_time(self, mesa, time):
        jogadores = [j for j in mesa.jogadores_na_mesa.all() if j.time == time]
        return MesaJogadorSerializer(sorted(jogadores, key=lambda j: j.id), many=True).data

    def get_time_1(self, mesa):
        return self._jogadores_do_time(mesa, 1)

    def get_time_2(self, mesa):
        return self._jogadores_do_time(mesa, 2)


class ResultadoMesaSerializer(serializers.Serializer):
    """Placar de uma mesa. O vencedor precisa ser coerente com o placar."""

    pontuacao_time_1 = serializers.IntegerField(min_value=0)
    pontuacao_time_2 = serializers.IntegerField(min_value=0)
    time_vencedor = serializers.ChoiceField(choices=Mesa.Resultado.choices, help_text='0=Empate, 1=Time 1, 2=Time 2')

    def validate(self, data):
        p1, p2, vencedor = data['pontuacao_time_1'], data['pontuacao_time_2'], data['time_vencedor']
        if vencedor == Mesa.Resultado.TIME_1 and p1 <= p2:
            raise serializers.ValidationError('Time 1 não pode ser o vencedor com pontuação menor ou igual ao Time 2')
        if vencedor == Mesa.Resultado.TIME_2 and p2 <= p1:
            raise serializers.ValidationError('Time 2 não pode ser o vencedor com pontuação menor ou igual ao Time 1')
        if vencedor == Mesa.Resultado.EMPATE and p1 != p2:
            raise serializers.ValidationError('Para empate, as pontuações devem ser iguais')
        return data


# ------------------------------------------------------------------------------
# Payloads das ações de emparelhamento
# ------------------------------------------------------------------------------


class IniciarRodadaSerializer(serializers.Serializer):
    forcar_inicio = serializers.BooleanField(
        default=False, help_text='Inicia mesmo que alguma mesa não tenha exatamente 4 jogadores.'
    )


class EmparelhamentoAutomaticoSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=['random', 'swiss'], default='swiss')


class EditarEmparelhamentoSerializer(serializers.Serializer):
    acao = serializers.ChoiceField(choices=['mover_jogador_para_mesa', 'alterar_time_jogador'])
    jogador_id = serializers.IntegerField()
    nova_mesa_id = serializers.IntegerField(required=False, help_text='Obrigatório para mover_jogador_para_mesa.')
    novo_time = serializers.ChoiceField(
        choices=[1, 2], required=False, help_text='Obrigatório para alterar_time_jogador.'
    )

    def validate(self, data):
        if data['acao'] == 'mover_jogador_para_mesa' and not data.get('nova_mesa_id'):
            raise serializers.ValidationError('nova_mesa_id é obrigatório para mover_jogador_para_mesa')
        if data['acao'] == 'alterar_time_jogador' and not data.get('novo_time'):
            raise serializers.ValidationError('novo_time é obrigatório para alterar_time_jogador')
        return data


class PosicionarJogadorSerializer(serializers.Serializer):
    mesa_id = serializers.IntegerField()
    time = serializers.ChoiceField(choices=[1, 2])
    position = serializers.ChoiceField(choices=[1, 2], default=1, help_text='Posição dentro do time (1 ou 2).')
    jogador_id = serializers.IntegerField(default=0, help_text='0 esvazia a posição.')
