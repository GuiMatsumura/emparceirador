"""
Settings usadas apenas pelos testes automatizados.

Uso: python manage.py test --settings=core.settings_test

Troca o banco por SQLite em memória (não depende do Postgres nem toca em dados reais)
e o envio de e-mails pelo backend em memória do Django.
"""
from .settings import *  # noqa: F401,F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# Hash rápido para acelerar a criação de usuários nos testes
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
