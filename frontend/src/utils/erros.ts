import { isAxiosError } from 'axios';

/** Achata as mensagens de erro de validação do DRF ({campo: [msgs]} ou [msgs]). */
function mensagensDeValidacao(dados: unknown): string[] {
  if (typeof dados === 'string') return [dados];
  if (Array.isArray(dados)) return dados.flatMap(mensagensDeValidacao);
  if (dados && typeof dados === 'object') {
    return Object.entries(dados).flatMap(([campo, valor]) => {
      const mensagens = mensagensDeValidacao(valor);
      return campo === 'non_field_errors' || campo === 'detail' ? mensagens : mensagens.map((m) => `${campo}: ${m}`);
    });
  }
  return [];
}

/**
 * Converte qualquer erro (Axios ou não) em uma mensagem legível para o usuário.
 *
 * A API responde erros como {"detail": "..."} (regras de negócio/permissão) ou
 * {"campo": ["..."]} (validação). Erros de rede e 500 viram mensagens genéricas.
 */
export function mensagemDeErro(erro: unknown, padrao = 'Ocorreu um erro inesperado. Tente novamente.'): string {
  if (isAxiosError(erro)) {
    if (!erro.response) return 'Não foi possível conectar ao servidor. Verifique sua conexão.';
    const { status, data } = erro.response;
    if (status >= 500) return 'Erro interno do servidor. Tente novamente mais tarde.';
    const mensagens = mensagensDeValidacao(data);
    if (mensagens.length) return mensagens.join('\n');
    if (status === 403) return 'Você não tem permissão para realizar esta ação.';
    if (status === 404) return 'Registro não encontrado.';
    return padrao;
  }
  if (erro instanceof Error && erro.message) return erro.message;
  return padrao;
}
