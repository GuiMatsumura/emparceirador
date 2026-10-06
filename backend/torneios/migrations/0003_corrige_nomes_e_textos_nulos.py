from django.db import migrations


def textos_nulos_para_vazio(apps, schema_editor):
    Torneio = apps.get_model('torneios', 'Torneio')
    Torneio.objects.filter(descricao__isnull=True).update(descricao='')
    Torneio.objects.filter(banner__isnull=True).update(banner='')


class Migration(migrations.Migration):
    dependencies = [
        ('torneios', '0002_rodada_data_inicio'),
    ]

    operations = [
        # Corrige o typo "incricao" preservando os dados
        migrations.RenameField(model_name='torneio', old_name='incricao_gratuita', new_name='inscricao_gratuita'),
        migrations.RenameField(model_name='torneio', old_name='valor_incricao', new_name='valor_inscricao'),
        # Textos deixam de aceitar NULL (string vazia é o "sem valor")
        migrations.RunPython(textos_nulos_para_vazio, migrations.RunPython.noop),
    ]
