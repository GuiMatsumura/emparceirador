"""
Popula o banco com dados de exemplo para desenvolvimento.

Uso: python manage.py popular_exemplo

Cria (se ainda não existirem) uma loja, 9 jogadores e um torneio aberto com todos inscritos.
Senha de todas as contas: senha-exemplo-123
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from torneios.models import Inscricao, Torneio
from usuarios.models import Usuario

SENHA = 'senha-exemplo-123'
QTD_JOGADORES = 9  # 9 = duas mesas e um bye, para exercitar o fluxo completo


class Command(BaseCommand):
    help = 'Cria dados de exemplo (loja, jogadores e um torneio aberto) para desenvolvimento.'

    def _usuario(self, email, username, tipo):
        usuario, criado = Usuario.objects.get_or_create(email=email, defaults={'username': username, 'tipo': tipo})
        if criado:
            usuario.set_password(SENHA)
            usuario.save(update_fields=['password'])
        return usuario

    @transaction.atomic
    def handle(self, *args, **options):
        loja = self._usuario('loja@exemplo.com', 'Loja Exemplo', Usuario.TipoUsuario.LOJA)
        jogadores = [
            self._usuario(f'jogador{i}@exemplo.com', f'Jogador {i}', Usuario.TipoUsuario.JOGADOR)
            for i in range(1, QTD_JOGADORES + 1)
        ]

        torneio, _ = Torneio.objects.get_or_create(
            nome='Torneio de Exemplo',
            id_loja=loja,
            defaults={
                'regras': 'Formato Commander padrão.\nPartidas de 50 minutos.',
                'descricao': 'Torneio criado pelo comando popular_exemplo.',
                'data_inicio': timezone.now() + timedelta(days=1),
                'banner': 'b1.png',
                'vagas_limitadas': False,
                'quantidade_rodadas': 3,
            },
        )
        for jogador in jogadores:
            Inscricao.objects.get_or_create(id_usuario=jogador, id_torneio=torneio)

        self.stdout.write(
            self.style.SUCCESS(
                f'Pronto. Loja: loja@exemplo.com | Jogadores: jogador1..{QTD_JOGADORES}@exemplo.com | Senha: {SENHA}'
            )
        )
