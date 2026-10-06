"""
Testes da API de torneios.

Rodar com: python manage.py test --settings=core.settings_test
"""

from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from usuarios.models import Usuario

from .models import Inscricao, Mesa, MesaJogador, RankingParcial, Rodada, Torneio
from .ranking_utils import calcular_e_salvar_ranking_parcial


class BaseTorneioTestCase(APITestCase):
    """Cria uma loja, um torneio e helpers para montar rodadas/mesas."""

    def setUp(self):
        self.loja = self.criar_usuario('loja@teste.com', 'LOJA')
        self.outra_loja = self.criar_usuario('outra@teste.com', 'LOJA')
        self.admin = self.criar_usuario('admin@teste.com', 'ADMIN')
        self.torneio = Torneio.objects.create(
            id_loja=self.loja,
            nome='Torneio Teste',
            regras='Regras',
            status='Em Andamento',
            data_inicio=timezone.now() + timedelta(days=1),
        )

    def criar_usuario(self, email, tipo='JOGADOR'):
        return Usuario.objects.create_user(email=email, username=email, password='senha-forte-123', tipo=tipo)

    def criar_jogadores(self, quantidade, torneio=None, prefixo='j'):
        torneio = torneio or self.torneio
        jogadores = []
        for i in range(quantidade):
            jogador = self.criar_usuario(f'{prefixo}{i}@teste.com')
            Inscricao.objects.create(id_usuario=jogador, id_torneio=torneio)
            jogadores.append(jogador)
        return jogadores

    def criar_rodada(self, numero, status, torneio=None):
        return Rodada.objects.create(
            id_torneio=torneio or self.torneio,
            numero_rodada=numero,
            status=status,
            data_inicio=timezone.now(),  # posterior às inscrições já criadas no teste
        )

    def criar_mesa(self, rodada, time_1, time_2, numero=1, vencedor=None):
        mesa = Mesa.objects.create(id_rodada=rodada, numero_mesa=numero, time_vencedor=vencedor)
        for jogador in time_1:
            MesaJogador.objects.create(id_mesa=mesa, id_usuario=jogador, time=1)
        for jogador in time_2:
            MesaJogador.objects.create(id_mesa=mesa, id_usuario=jogador, time=2)
        return mesa

    def duplas_da_rodada(self, rodada):
        duplas = set()
        for mesa in Mesa.objects.filter(id_rodada=rodada):
            for time in (1, 2):
                ids = frozenset(
                    MesaJogador.objects.filter(id_mesa=mesa, time=time).values_list('id_usuario_id', flat=True)
                )
                duplas.add(ids)
        return duplas

    def jogadores_em_mesas(self, rodada):
        return set(MesaJogador.objects.filter(id_mesa__id_rodada=rodada).values_list('id_usuario_id', flat=True))


class ReportarResultadoTests(BaseTorneioTestCase):
    """B1 — somente jogadores da mesa podem reportar o resultado."""

    def setUp(self):
        super().setUp()
        self.jogadores = self.criar_jogadores(5)
        rodada = self.criar_rodada(1, 'Em Andamento')
        self.mesa = self.criar_mesa(rodada, self.jogadores[:2], self.jogadores[2:4])
        self.url = f'/api/v1/torneios/mesas/{self.mesa.id}/reportar_resultado/'
        self.payload = {'pontuacao_time_1': 2, 'pontuacao_time_2': 1, 'time_vencedor': 1}

    def test_anonimo_nao_reporta_resultado(self):
        resposta = self.client.post(self.url, self.payload, format='json')
        self.assertIn(resposta.status_code, (401, 403))
        self.mesa.refresh_from_db()
        self.assertIsNone(self.mesa.time_vencedor)

    def test_jogador_fora_da_mesa_nao_reporta_resultado(self):
        self.client.force_authenticate(self.jogadores[4])
        resposta = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(resposta.status_code, 403)
        self.mesa.refresh_from_db()
        self.assertIsNone(self.mesa.time_vencedor)

    def test_jogador_da_mesa_reporta_resultado(self):
        self.client.force_authenticate(self.jogadores[0])
        resposta = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(resposta.status_code, 200)
        self.mesa.refresh_from_db()
        self.assertEqual(self.mesa.time_vencedor, 1)

    def test_mesa_inexistente_retorna_404(self):
        self.client.force_authenticate(self.jogadores[0])
        resposta = self.client.post('/api/v1/torneios/mesas/99999/reportar_resultado/', self.payload, format='json')
        self.assertEqual(resposta.status_code, 404)


class EditarEmparelhamentoTests(BaseTorneioTestCase):
    """B2 — o endpoint editar_emparelhamento deve funcionar na fase de Emparelhamento."""

    def setUp(self):
        super().setUp()
        self.jogadores = self.criar_jogadores(8)
        self.rodada = self.criar_rodada(2, 'Emparelhamento')
        self.mesa_1 = self.criar_mesa(self.rodada, self.jogadores[:2], self.jogadores[2:4], numero=1)
        self.mesa_2 = self.criar_mesa(self.rodada, self.jogadores[4:6], self.jogadores[6:8], numero=2)
        self.url = f'/api/v1/torneios/rodadas/{self.rodada.id}/editar_emparelhamento/'
        self.client.force_authenticate(self.loja)

    def test_alterar_time_do_jogador(self):
        resposta = self.client.post(
            self.url,
            {
                'acao': 'alterar_time_jogador',
                'jogador_id': self.jogadores[0].id,
                'novo_time': 2,
            },
            format='json',
        )
        self.assertEqual(resposta.status_code, 200, resposta.data)
        self.assertEqual(MesaJogador.objects.get(id_usuario=self.jogadores[0]).time, 2)

    def test_mover_jogador_para_outra_mesa(self):
        resposta = self.client.post(
            self.url,
            {
                'acao': 'mover_jogador_para_mesa',
                'jogador_id': self.jogadores[0].id,
                'nova_mesa_id': self.mesa_2.id,
            },
            format='json',
        )
        self.assertEqual(resposta.status_code, 200, resposta.data)
        self.assertEqual(MesaJogador.objects.get(id_usuario=self.jogadores[0]).id_mesa_id, self.mesa_2.id)

    def test_outra_loja_nao_edita(self):
        self.client.force_authenticate(self.outra_loja)
        resposta = self.client.post(
            self.url,
            {
                'acao': 'alterar_time_jogador',
                'jogador_id': self.jogadores[0].id,
                'novo_time': 2,
            },
            format='json',
        )
        self.assertEqual(resposta.status_code, 403)


class PropriedadeDoTorneioTests(BaseTorneioTestCase):
    """B5 — uma loja não pode alterar mesas/rodadas/torneios de outra loja."""

    def setUp(self):
        super().setUp()
        self.jogadores = self.criar_jogadores(4)
        self.rodada = self.criar_rodada(1, 'Em Andamento')
        self.mesa = self.criar_mesa(self.rodada, self.jogadores[:2], self.jogadores[2:4])
        self.client.force_authenticate(self.outra_loja)

    def test_outra_loja_nao_edita_resultado_manual(self):
        resposta = self.client.patch(
            f'/api/v1/torneios/mesas/{self.mesa.id}/editar_manual/',
            {'time_vencedor': 1, 'pontuacao_time_1': 1, 'pontuacao_time_2': 0},
            format='json',
        )
        self.assertEqual(resposta.status_code, 403)
        self.mesa.refresh_from_db()
        self.assertIsNone(self.mesa.time_vencedor)

    def test_outra_loja_nao_edita_jogadores_da_mesa(self):
        resposta = self.client.patch(
            f'/api/v1/torneios/mesas/{self.mesa.id}/editar_jogadores/', {'jogadores': []}, format='json'
        )
        self.assertEqual(resposta.status_code, 403)
        self.assertEqual(MesaJogador.objects.filter(id_mesa=self.mesa).count(), 4)

    def test_outra_loja_nao_apaga_mesa(self):
        resposta = self.client.delete(f'/api/v1/torneios/mesas/{self.mesa.id}/')
        self.assertEqual(resposta.status_code, 403)
        self.assertTrue(Mesa.objects.filter(id=self.mesa.id).exists())

    def test_outra_loja_nao_apaga_rodada(self):
        resposta = self.client.delete(f'/api/v1/torneios/rodadas/{self.rodada.id}/')
        self.assertEqual(resposta.status_code, 403)
        self.assertTrue(Rodada.objects.filter(id=self.rodada.id).exists())

    def test_outra_loja_nao_cria_rodada_em_torneio_alheio(self):
        resposta = self.client.post(
            '/api/v1/torneios/rodadas/',
            {
                'id_torneio': self.torneio.id,
                'numero_rodada': 5,
                'status': 'Emparelhamento',
            },
            format='json',
        )
        self.assertEqual(resposta.status_code, 403)

    def test_dona_edita_resultado_manual(self):
        self.client.force_authenticate(self.loja)
        resposta = self.client.patch(
            f'/api/v1/torneios/mesas/{self.mesa.id}/editar_manual/',
            {'time_vencedor': 1, 'pontuacao_time_1': 1, 'pontuacao_time_2': 0},
            format='json',
        )
        self.assertEqual(resposta.status_code, 200)

    def test_loja_nao_transfere_torneio_para_outra_loja(self):
        self.client.force_authenticate(self.loja)
        torneio = Torneio.objects.create(
            id_loja=self.loja,
            nome='Aberto',
            regras='r',
            status='Aberto',
            data_inicio=timezone.now() + timedelta(days=2),
        )
        resposta = self.client.put(
            f'/api/v1/torneios/torneios/{torneio.id}/',
            {
                'id_loja': self.outra_loja.id,
                'nome': 'Novo nome',
                'regras': 'r',
                'status': 'Aberto',
                'data_inicio': (timezone.now() + timedelta(days=2)).isoformat(),
            },
            format='json',
        )
        self.assertEqual(resposta.status_code, 200, resposta.data)
        torneio.refresh_from_db()
        self.assertEqual(torneio.id_loja_id, self.loja.id)
        self.assertEqual(torneio.nome, 'Novo nome')


class InscricaoTests(BaseTorneioTestCase):
    def setUp(self):
        super().setUp()
        self.aberto = Torneio.objects.create(
            id_loja=self.loja,
            nome='Aberto',
            regras='r',
            status='Aberto',
            vagas_limitadas=True,
            qnt_vagas=2,
            data_inicio=timezone.now() + timedelta(days=1),
        )

    def test_desinscrever_grava_data_saida(self):
        """B6"""
        jogador = self.criar_jogadores(1)[0]
        inscricao = Inscricao.objects.get(id_usuario=jogador, id_torneio=self.torneio)
        self.client.force_authenticate(jogador)
        resposta = self.client.post(f'/api/v1/torneios/inscricoes/{inscricao.id}/desinscrever/')
        self.assertEqual(resposta.status_code, 200)
        inscricao.refresh_from_db()
        self.assertEqual(inscricao.status, 'Cancelado')
        self.assertIsNotNone(inscricao.data_saida)

    def test_inscricao_cancelada_nao_ocupa_vaga(self):
        """B7"""
        cancelado, ativo = self.criar_jogadores(2, torneio=self.aberto)
        Inscricao.objects.filter(id_usuario=cancelado).update(status='Cancelado')
        novo = self.criar_usuario('novo@teste.com')
        self.client.force_authenticate(novo)
        resposta = self.client.post('/api/v1/torneios/inscricoes/', {'id_torneio': self.aberto.id}, format='json')
        self.assertEqual(resposta.status_code, 201, resposta.data)

    def test_loja_inscricao_cancelada_nao_ocupa_vaga(self):
        """B7 — mesmo critério no serializer da loja"""
        cancelado, ativo = self.criar_jogadores(2, torneio=self.aberto)
        Inscricao.objects.filter(id_usuario=cancelado).update(status='Cancelado')
        novo = self.criar_usuario('novo@teste.com')
        self.client.force_authenticate(self.loja)
        resposta = self.client.post(
            '/api/v1/torneios/inscricoes/', {'id_torneio': self.aberto.id, 'id_usuario': novo.id}, format='json'
        )
        self.assertEqual(resposta.status_code, 201, resposta.data)

    def test_jogador_nao_reativa_propria_inscricao(self):
        """B10"""
        jogador = self.criar_jogadores(1)[0]
        inscricao = Inscricao.objects.get(id_usuario=jogador, id_torneio=self.torneio)
        inscricao.status = 'Cancelado'
        inscricao.save()
        self.client.force_authenticate(jogador)
        resposta = self.client.post(f'/api/v1/torneios/inscricoes/{inscricao.id}/reativar/')
        self.assertEqual(resposta.status_code, 403)
        inscricao.refresh_from_db()
        self.assertEqual(inscricao.status, 'Cancelado')

    def test_loja_reativa_inscricao(self):
        jogador = self.criar_jogadores(1)[0]
        inscricao = Inscricao.objects.get(id_usuario=jogador, id_torneio=self.torneio)
        inscricao.status = 'Cancelado'
        inscricao.save()
        self.client.force_authenticate(self.loja)
        resposta = self.client.post(f'/api/v1/torneios/inscricoes/{inscricao.id}/reativar/')
        self.assertEqual(resposta.status_code, 200)


class IniciarTorneioTests(BaseTorneioTestCase):
    def test_inscricao_inativa_nao_e_emparelhada(self):
        """B8 — apenas inscrições com status 'Inscrito' entram nas mesas."""
        torneio = Torneio.objects.create(
            id_loja=self.loja, nome='T', regras='r', status='Aberto', data_inicio=timezone.now() + timedelta(days=1)
        )
        jogadores = self.criar_jogadores(5, torneio=torneio)
        Inscricao.objects.filter(id_usuario=jogadores[4]).update(status='Inativo')
        self.client.force_authenticate(self.loja)
        for _ in range(10):  # embaralhamento aleatório: repete para não passar por sorte
            Rodada.objects.filter(id_torneio=torneio).delete()
            Torneio.objects.filter(id=torneio.id).update(status='Aberto')
            resposta = self.client.post(f'/api/v1/torneios/torneios/{torneio.id}/iniciar/')
            self.assertEqual(resposta.status_code, 200, resposta.data)
            rodada = Rodada.objects.get(id_torneio=torneio, numero_rodada=1)
            self.assertNotIn(jogadores[4].id, self.jogadores_em_mesas(rodada))

    def test_iniciar_registra_data_inicio_da_rodada(self):
        torneio = Torneio.objects.create(
            id_loja=self.loja, nome='T', regras='r', status='Aberto', data_inicio=timezone.now() + timedelta(days=1)
        )
        self.criar_jogadores(4, torneio=torneio)
        self.client.force_authenticate(self.loja)
        self.client.post(f'/api/v1/torneios/torneios/{torneio.id}/iniciar/')
        self.assertIsNotNone(Rodada.objects.get(id_torneio=torneio, numero_rodada=1).data_inicio)


class TorneioSemRodadaTests(BaseTorneioTestCase):
    def test_proxima_rodada_sem_rodadas_retorna_400(self):
        self.client.force_authenticate(self.loja)
        resposta = self.client.post(f'/api/v1/torneios/torneios/{self.torneio.id}/proxima_rodada/')
        self.assertEqual(resposta.status_code, 400)

    def test_finalizar_sem_rodadas_retorna_400(self):
        self.client.force_authenticate(self.loja)
        resposta = self.client.post(f'/api/v1/torneios/torneios/{self.torneio.id}/finalizar/')
        self.assertEqual(resposta.status_code, 400)


class TorneioAtrasadoTests(BaseTorneioTestCase):
    """B15 — torneio 'Aberto' que passou da tolerância some da listagem, mas não do detalhe/ações."""

    def setUp(self):
        super().setUp()
        self.atrasado = Torneio.objects.create(
            id_loja=self.loja,
            nome='Atrasado',
            regras='r',
            status='Aberto',
            data_inicio=timezone.now() - timedelta(hours=3),
        )
        self.criar_jogadores(4, torneio=self.atrasado)

    def test_some_da_listagem(self):
        resposta = self.client.get('/api/v1/torneios/torneios/')
        self.assertNotIn(self.atrasado.id, [t['id'] for t in resposta.data])

    def test_detalhe_continua_acessivel(self):
        resposta = self.client.get(f'/api/v1/torneios/torneios/{self.atrasado.id}/')
        self.assertEqual(resposta.status_code, 200)

    def test_loja_consegue_iniciar(self):
        self.client.force_authenticate(self.loja)
        resposta = self.client.post(f'/api/v1/torneios/torneios/{self.atrasado.id}/iniciar/')
        self.assertEqual(resposta.status_code, 200, resposta.data)


class ProximaRodadaTests(BaseTorneioTestCase):
    def avancar(self):
        self.client.force_authenticate(self.loja)
        return self.client.post(f'/api/v1/torneios/torneios/{self.torneio.id}/proxima_rodada/')

    def test_nao_repete_dupla_quando_ha_alternativa(self):
        """B11 — Swiss deve evitar repetir parceiros."""
        a, b, c, d = self.criar_jogadores(4)
        rodada = self.criar_rodada(1, 'Em Andamento')
        self.criar_mesa(rodada, [a, d], [b, c], vencedor=0)  # empate: todos com mesma pontuação
        resposta = self.avancar()
        self.assertEqual(resposta.status_code, 200, resposta.data)
        nova = Rodada.objects.get(id_torneio=self.torneio, numero_rodada=2)
        duplas = self.duplas_da_rodada(nova)
        self.assertNotIn(frozenset({a.id, d.id}), duplas)
        self.assertNotIn(frozenset({b.id, c.id}), duplas)

    def test_bye_vai_para_quem_ainda_nao_teve(self):
        """B11 — o mesmo jogador não deve receber bye duas vezes se outro ainda não recebeu."""
        self.torneio.pontuacao_bye = 0
        self.torneio.save()
        a, b, c, d, e = self.criar_jogadores(5)
        rodada = self.criar_rodada(1, 'Em Andamento')
        self.criar_mesa(rodada, [a, b], [c, d], vencedor=1)  # e ficou de bye
        resposta = self.avancar()
        self.assertEqual(resposta.status_code, 200, resposta.data)
        nova = Rodada.objects.get(id_torneio=self.torneio, numero_rodada=2)
        self.assertIn(e.id, self.jogadores_em_mesas(nova))

    def test_respeita_quantidade_de_rodadas(self):
        """B12"""
        self.torneio.quantidade_rodadas = 1
        self.torneio.save()
        a, b, c, d = self.criar_jogadores(4)
        rodada = self.criar_rodada(1, 'Em Andamento')
        self.criar_mesa(rodada, [a, b], [c, d], vencedor=1)
        resposta = self.avancar()
        self.assertEqual(resposta.status_code, 400)
        self.assertFalse(Rodada.objects.filter(id_torneio=self.torneio, numero_rodada=2).exists())

    def test_iniciar_rodada_registra_data_inicio(self):
        a, b, c, d = self.criar_jogadores(4)
        rodada = Rodada.objects.create(id_torneio=self.torneio, numero_rodada=1, status='Emparelhamento')
        self.criar_mesa(rodada, [a, b], [c, d])
        self.client.force_authenticate(self.loja)
        resposta = self.client.post(f'/api/v1/torneios/rodadas/{rodada.id}/iniciar_rodada/', {}, format='json')
        self.assertEqual(resposta.status_code, 200)
        rodada.refresh_from_db()
        self.assertIsNotNone(rodada.data_inicio)


class RankingTests(BaseTorneioTestCase):
    def test_inscrito_depois_da_rodada_nao_ganha_bye_retroativo(self):
        """B9"""
        a, b, c, d = self.criar_jogadores(4)
        rodada = self.criar_rodada(1, 'Finalizada')
        self.criar_mesa(rodada, [a, b], [c, d], vencedor=1)
        atrasado = self.criar_jogadores(1, prefixo='atrasado')[0]
        Inscricao.objects.filter(id_usuario=atrasado).update(data_inscricao=rodada.data_inicio + timedelta(minutes=5))

        ranking = calcular_e_salvar_ranking_parcial(self.torneio, 1)

        pontos = {item['jogador_id']: item['pontos'] for item in ranking}
        self.assertEqual(pontos.get(atrasado.id, 0), 0)
        self.assertEqual(pontos[a.id], self.torneio.pontuacao_vitoria)

    def test_sobressalente_inscrito_antes_ganha_bye(self):
        a, b, c, d, e = self.criar_jogadores(5)
        rodada = self.criar_rodada(1, 'Finalizada')
        self.criar_mesa(rodada, [a, b], [c, d], vencedor=1)
        ranking = calcular_e_salvar_ranking_parcial(self.torneio, 1)
        pontos = {item['jogador_id']: item['pontos'] for item in ranking}
        self.assertEqual(pontos[e.id], self.torneio.pontuacao_bye)
        self.assertEqual(RankingParcial.objects.filter(id_torneio=self.torneio).count(), 5)
