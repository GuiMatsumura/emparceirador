/**
 * Autenticação e conta do usuário.
 * Erros da API são propagados; use utils/erros.mensagemDeErro para exibi-los.
 */
import type { ILoginCredenciais, IUsuario, IUsuarioCadastro } from '../tipos/tipos';
import api from './api';

export async function efetuarLogin(credenciais: ILoginCredenciais): Promise<IUsuario> {
  const { data } = await api.post<{ dados: IUsuario }>('/auth/login/', credenciais);
  return data.dados;
}

export async function efetuarLogout(): Promise<void> {
  await api.post('/auth/logout/');
}

/** Usuário da sessão atual, ou null se não há sessão (a API responde 204). */
export async function verificarSessao(): Promise<IUsuario | null> {
  const resposta = await api.get<IUsuario>('/auth/validar-sessao/');
  return resposta.status === 200 ? resposta.data : null;
}

export async function cadastrarUsuario(usuario: IUsuarioCadastro): Promise<IUsuario> {
  const { data } = await api.post<IUsuario>('/auth/usuarios/', usuario);
  return data;
}

/** Envia por e-mail um token de redefinição de senha. */
export async function solicitarTokenRecuperacaoSenha(email: string): Promise<void> {
  await api.post('/auth/requisitar-troca-senha/', { email });
}

/** Valida o token; a nova senha é enviada por e-mail. */
export async function validarTokenRecuperacao(email: string, token: string): Promise<void> {
  await api.post('/auth/validar-token-redefinir-senha/', { email, token });
}

export async function alterarSenhaUsuario(userId: number, senhaAntiga: string, novaSenha: string): Promise<void> {
  await api.post(`/auth/alterar-senha/${userId}/`, { senha_antiga: senhaAntiga, nova_senha: novaSenha });
}
