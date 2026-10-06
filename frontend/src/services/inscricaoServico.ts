/**
 * Inscrições em torneios.
 *
 * Regra de saída: antes do torneio começar a inscrição é excluída; depois disso vira
 * "Cancelado" (desinscrição), preservando o histórico de partidas.
 */
import type { IInscricao, StatusTorneio } from '../tipos/tipos';
import api from './api';

const URL = '/torneios/inscricoes/';

/** Inscrições visíveis ao usuário logado (jogador: as dele; loja: dos torneios dela). */
export async function listarInscricoes(idTorneio?: number): Promise<IInscricao[]> {
  const params = idTorneio ? { id_torneio: idTorneio } : undefined;
  const { data } = await api.get<IInscricao[]>(URL, { params });
  return data;
}

export async function listarInscricoesAtivas(idTorneio: number): Promise<IInscricao[]> {
  return (await listarInscricoes(idTorneio)).filter((i) => i.status === 'Inscrito');
}

/** Inscrição do jogador logado no torneio (ativa ou não), se existir. */
export async function buscarMinhaInscricao(idTorneio: number): Promise<IInscricao | null> {
  const [inscricao] = await listarInscricoes(idTorneio);
  return inscricao ?? null;
}

/** Jogador se inscreve (sem id_usuario) ou loja inscreve um jogador (com id_usuario). */
export async function inscreverNoTorneio(dados: {
  id_torneio: number;
  decklist?: string;
  id_usuario?: number;
}): Promise<IInscricao> {
  const { data } = await api.post<{ message: string; inscricao: IInscricao }>(URL, dados);
  return data.inscricao;
}

/** Loja inscreve um jogador já cadastrado pelo e-mail. */
export async function inscreverJogadorPorEmail(torneioId: number, email: string): Promise<IInscricao> {
  const { data } = await api.post<{ message: string; inscricao: IInscricao }>(`${URL}inscrever_por_email/`, {
    torneio_id: torneioId,
    email,
  });
  return data.inscricao;
}

export async function reativarInscricao(inscricaoId: number): Promise<IInscricao> {
  const { data } = await api.post<{ message: string; inscricao: IInscricao }>(`${URL}${inscricaoId}/reativar/`);
  return data.inscricao;
}

/** Tira a inscrição do torneio: exclui se ele ainda não começou, senão desinscreve (soft delete). */
export async function retirarInscricao(inscricaoId: number, statusTorneio: StatusTorneio): Promise<void> {
  if (statusTorneio === 'Aberto') {
    await api.delete(`${URL}${inscricaoId}/`);
  } else {
    await api.post(`${URL}${inscricaoId}/desinscrever/`);
  }
}

/** Jogador sai de um torneio em que está inscrito. */
export async function sairDoTorneio(idTorneio: number, statusTorneio: StatusTorneio): Promise<void> {
  const inscricao = await buscarMinhaInscricao(idTorneio);
  if (!inscricao || inscricao.status !== 'Inscrito') {
    throw new Error('Você não tem uma inscrição ativa neste torneio.');
  }
  await retirarInscricao(inscricao.id, statusTorneio);
}
