/**
 * Rodadas e fase de emparelhamento.
 */
import type { IMesaRodada, IParticipante, IRodada } from '../tipos/tipos';
import api from './api';

const URL = '/torneios/rodadas/';

export async function buscarRodadasDoTorneio(torneioId: number): Promise<IRodada[]> {
  const { data } = await api.get<IRodada[]>(URL, { params: { torneio_id: torneioId } });
  return data;
}

export async function buscarMesasDaRodada(rodadaId: number): Promise<IMesaRodada[]> {
  const { data } = await api.get<IMesaRodada[]>('/torneios/mesas/', { params: { rodada_id: rodadaId } });
  return data;
}

/** Jogadores ativos que ficaram de fora das mesas (bye). */
export async function buscarSobressalentes(rodadaId: number): Promise<IParticipante[]> {
  const { data } = await api.get<IParticipante[]>(`${URL}${rodadaId}/sobressalentes/`);
  return data;
}

/** Descarta as mesas da rodada e gera um novo emparelhamento. */
export async function emparelharRodada(
  rodadaId: number,
  tipo: 'swiss' | 'random' = 'swiss',
): Promise<{ message: string; mesas_criadas: number; total_jogadores: number }> {
  const { data } = await api.post(`${URL}${rodadaId}/emparelhar_automatico/`, { tipo });
  return data;
}

/** Encerra a fase de emparelhamento: jogadores passam a poder reportar resultados. */
export async function iniciarRodada(rodadaId: number, forcarInicio = false): Promise<{ message: string }> {
  const { data } = await api.post(`${URL}${rodadaId}/iniciar_rodada/`, { forcar_inicio: forcarInicio });
  return data;
}

/** Coloca um jogador numa posição (1 ou 2) de um time da mesa; jogadorId null esvazia a posição. */
export async function posicionarJogador(
  mesaId: number,
  time: 1 | 2,
  posicao: 1 | 2,
  jogadorId: number | null,
): Promise<{ message: string }> {
  const { data } = await api.post(`${URL}alterar_jogador_mesa/`, {
    mesa_id: mesaId,
    time,
    position: posicao,
    jogador_id: jogadorId ?? 0,
  });
  return data;
}
