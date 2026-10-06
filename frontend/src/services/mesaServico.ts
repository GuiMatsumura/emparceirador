/**
 * Resultado das mesas.
 */
import { isAxiosError } from 'axios';

import type { IMesaAtiva, IMesaRodada, ResultadoMesa } from '../tipos/tipos';
import api from './api';

const URL = '/torneios/mesas/';

/** O vencedor é sempre derivado do placar (a API exige coerência entre os dois). */
export function vencedorPeloPlacar(pontuacaoTime1: number, pontuacaoTime2: number): Exclude<ResultadoMesa, null> {
  if (pontuacaoTime1 > pontuacaoTime2) return 1;
  if (pontuacaoTime2 > pontuacaoTime1) return 2;
  return 0;
}

/** Mesa do jogador logado na rodada, ou null se ele ficou de fora (bye). */
export async function buscarMinhaMesaNaRodada(rodadaId: number): Promise<IMesaAtiva | null> {
  try {
    const { data } = await api.get<IMesaAtiva>(`${URL}minha_mesa_na_rodada/`, { params: { rodada_id: rodadaId } });
    return data;
  } catch (erro) {
    if (isAxiosError(erro) && erro.response?.status === 404) return null;
    throw erro;
  }
}

function placar(pontuacaoTime1: number, pontuacaoTime2: number) {
  return {
    pontuacao_time_1: pontuacaoTime1,
    pontuacao_time_2: pontuacaoTime2,
    time_vencedor: vencedorPeloPlacar(pontuacaoTime1, pontuacaoTime2),
  };
}

/** Jogador da mesa reporta o placar (rodada em andamento). */
export async function reportarResultadoMesa(mesaId: number, pontuacaoTime1: number, pontuacaoTime2: number) {
  const { data } = await api.post<{ mesa: IMesaRodada }>(
    `${URL}${mesaId}/reportar_resultado/`,
    placar(pontuacaoTime1, pontuacaoTime2),
  );
  return data.mesa;
}

/** Loja confirma/corrige o placar de uma mesa. */
export async function editarResultadoMesa(mesaId: number, pontuacaoTime1: number, pontuacaoTime2: number) {
  const { data } = await api.patch<{ mesa: IMesaRodada }>(
    `${URL}${mesaId}/editar_manual/`,
    placar(pontuacaoTime1, pontuacaoTime2),
  );
  return data.mesa;
}
