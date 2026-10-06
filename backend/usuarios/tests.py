"""
Testes da API de usuários/autenticação.

Rodar com: python manage.py test --settings=core.settings_test
"""

from datetime import timedelta

from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Usuario


class CadastroUsuarioTests(APITestCase):
    url = '/api/v1/auth/usuarios/'

    def test_cadastro_publico_nao_cria_admin(self):
        """B3"""
        resposta = self.client.post(
            self.url,
            {
                'email': 'hacker@teste.com',
                'username': 'hacker',
                'password': 'senha-forte-123',
                'tipo': 'ADMIN',
            },
            format='json',
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertFalse(Usuario.objects.filter(tipo='ADMIN').exists())

    def test_cadastro_de_jogador(self):
        resposta = self.client.post(
            self.url,
            {
                'email': 'jogador@teste.com',
                'username': 'jogador',
                'password': 'senha-forte-123',
                'tipo': 'JOGADOR',
            },
            format='json',
        )
        self.assertEqual(resposta.status_code, 201, resposta.data)

    def test_cadastro_exige_tipo(self):
        resposta = self.client.post(
            self.url,
            {
                'email': 'semtipo@teste.com',
                'username': 'semtipo',
                'password': 'senha-forte-123',
            },
            format='json',
        )
        self.assertEqual(resposta.status_code, 400)

    def test_admin_pode_criar_admin(self):
        admin = Usuario.objects.create_user(email='admin@teste.com', username='admin', password='x', tipo='ADMIN')
        self.client.force_authenticate(admin)
        resposta = self.client.post(
            self.url,
            {
                'email': 'admin2@teste.com',
                'username': 'admin2',
                'password': 'senha-forte-123',
                'tipo': 'ADMIN',
            },
            format='json',
        )
        self.assertEqual(resposta.status_code, 201, resposta.data)

    def test_cadastro_rejeita_senha_fraca(self):
        """B13"""
        resposta = self.client.post(
            self.url,
            {
                'email': 'fraca@teste.com',
                'username': 'fraca',
                'password': '1234',
                'tipo': 'JOGADOR',
            },
            format='json',
        )
        self.assertEqual(resposta.status_code, 400)
        self.assertIn('password', resposta.data)

    def test_usuario_nao_altera_proprio_tipo(self):
        jogador = Usuario.objects.create_user(email='j@teste.com', username='j', password='x', tipo='JOGADOR')
        self.client.force_authenticate(jogador)
        self.client.patch(f'{self.url}{jogador.id}/', {'tipo': 'ADMIN'}, format='json')
        jogador.refresh_from_db()
        self.assertEqual(jogador.tipo, 'JOGADOR')


class AlterarSenhaTests(APITestCase):
    def test_rejeita_nova_senha_fraca(self):
        """B13"""
        usuario = Usuario.objects.create_user(
            email='u@teste.com', username='u', password='senha-antiga-123', tipo='JOGADOR'
        )
        self.client.force_authenticate(usuario)
        resposta = self.client.post(
            f'/api/v1/auth/alterar-senha/{usuario.id}/',
            {
                'senha_antiga': 'senha-antiga-123',
                'nova_senha': '1234',
            },
            format='json',
        )
        self.assertEqual(resposta.status_code, 400)
        usuario.refresh_from_db()
        self.assertTrue(usuario.check_password('senha-antiga-123'))


@override_settings(CORS_ALLOWED_ORIGINS=['http://localhost:5173'], CSRF_TRUSTED_ORIGINS=[])
class ProtecaoCsrfPorOrigemTests(APITestCase):
    """Com sessão por cookie (SameSite=None), escritas vindas de outras origens devem ser bloqueadas."""

    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            email='u@teste.com', username='u', password='senha-antiga-123', tipo='JOGADOR'
        )
        self.client.post('/api/v1/auth/login/', {'email': 'u@teste.com', 'password': 'senha-antiga-123'}, format='json')
        self.url = '/api/v1/auth/logout/'

    def test_bloqueia_origem_desconhecida(self):
        resposta = self.client.post(self.url, HTTP_ORIGIN='https://site-malicioso.com')
        self.assertEqual(resposta.status_code, 403)

    def test_aceita_origem_permitida(self):
        resposta = self.client.post(self.url, HTTP_ORIGIN='http://localhost:5173')
        self.assertEqual(resposta.status_code, 200)

    def test_bloqueia_referer_desconhecido_sem_origin(self):
        resposta = self.client.post(self.url, HTTP_REFERER='https://site-malicioso.com/pagina')
        self.assertEqual(resposta.status_code, 403)

    def test_aceita_cliente_sem_origin_nem_referer(self):
        """Clientes fora do navegador (scripts, testes) não enviam Origin e não sofrem CSRF."""
        resposta = self.client.post(self.url)
        self.assertEqual(resposta.status_code, 200)

    def test_leitura_nao_e_bloqueada(self):
        resposta = self.client.get('/api/v1/auth/validar-sessao/', HTTP_ORIGIN='https://site-malicioso.com')
        self.assertEqual(resposta.status_code, 200)


class RedefinirSenhaTests(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            email='u@teste.com', username='u', password='senha-antiga-123', tipo='JOGADOR'
        )

    def requisitar_token(self):
        resposta = self.client.post('/api/v1/auth/requisitar-troca-senha/', {'email': 'u@teste.com'}, format='json')
        self.assertEqual(resposta.status_code, 200)
        self.usuario.refresh_from_db()
        return self.usuario.token_redefinir_senha

    def test_token_valido_redefine_senha(self):
        token = self.requisitar_token()
        resposta = self.client.post(
            '/api/v1/auth/validar-token-redefinir-senha/', {'email': 'u@teste.com', 'token': token}, format='json'
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)

    def test_token_expirado_e_rejeitado(self):
        """B13"""
        token = self.requisitar_token()
        Usuario.objects.filter(id=self.usuario.id).update(
            token_redefinir_senha_criado_em=timezone.now() - timedelta(hours=2)
        )
        resposta = self.client.post(
            '/api/v1/auth/validar-token-redefinir-senha/', {'email': 'u@teste.com', 'token': token}, format='json'
        )
        self.assertEqual(resposta.status_code, 400)
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.check_password('senha-antiga-123'))
