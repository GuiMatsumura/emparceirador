from django.db import migrations


def tokens_nulos_para_vazio(apps, schema_editor):
    Usuario = apps.get_model('usuarios', 'Usuario')
    Usuario.objects.filter(token_redefinir_senha__isnull=True).update(token_redefinir_senha='')


class Migration(migrations.Migration):
    dependencies = [
        ('usuarios', '0002_usuario_token_redefinir_senha_criado_em'),
    ]

    operations = [
        migrations.RunPython(tokens_nulos_para_vazio, migrations.RunPython.noop),
    ]
