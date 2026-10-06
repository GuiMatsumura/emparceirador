from rest_framework import status
from rest_framework.exceptions import APIException


class RegraDeNegocio(APIException):
    """
    Violação de regra do torneio (ex: iniciar com menos de 4 jogadores).

    Lançada pela camada de serviços; o DRF responde 400 com {"detail": "<mensagem>"}.
    """

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Operação não permitida.'
    default_code = 'regra_de_negocio'
