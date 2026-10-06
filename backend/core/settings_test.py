"""
Settings usadas apenas pelos testes automatizados.

Uso: python manage.py test --settings=core.settings_test

Troca o banco por SQLite em memória (não depende do Postgres nem toca em dados reais)
e o envio de e-mails pelo backend em memória do Django.
"""

from .settings import *  # noqa: F401,F403
from .settings import REST_FRAMEWORK

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# Hash rápido para acelerar a criação de usuários nos testes
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# Sem limite de requisições nos testes
REST_FRAMEWORK = {**REST_FRAMEWORK, 'DEFAULT_THROTTLE_RATES': {'autenticacao': None}}
