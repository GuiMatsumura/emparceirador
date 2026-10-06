/**
 * Torneios: consulta, criação/edição e ações do ciclo de vida (iniciar, avançar, finalizar, cancelar).
 * Erros da API são propagados; use utils/erros.mensagemDeErro para exibi-los.
 */
import type { IInscricao, IJogadorRanking, IRankingRodada, IRodada, ITorneio, ITorneioEntrada } from '../tipos/tipos';
import api from './api';
import { listarInscricoes } from './inscricaoServico';

const URL = '/torneios/torneios/';

export async function buscarTorneios(status?: string[]): Promise<ITorneio[]> {
  const params = status ? { status: status.join(',') } : undefined;
  const { data } = await api.get<ITorneio[]>(URL, { params });
  return data;
}

/** Torneios abertos ou em andamento (home). Para LOJA, a API já devolve só os dela. */
export function buscarTorneiosAtivos(): Promise<ITorneio[]> {
  return buscarTorneios(['Aberto', 'Em Andamento']);
}

export async function buscarTorneioPorId(id: number): Promise<ITorneio> {
  const { data } = await api.get<ITorneio>(`${URL}${id}/`);
  return data;
}

export async function criarTorneio(dados: ITorneioEntrada): Promise<ITorneio> {
  const { data } = await api.post<ITorneio>(URL, dados);
  return data;
}

export async function atualizarTorneio(id: number, dados: ITorneioEntrada): Promise<ITorneio> {
  const { data } = await api.put<ITorneio>(`${URL}${id}/`, dados);
  return data;
}

export interface RespostaIniciarTorneio {
  message: string;
  rodada: IRodada;
  mesas_criadas: number;
  total_jogadores: number;
}

export async function iniciarTorneio(id: number): Promise<RespostaIniciarTorneio> {
  const { data } = await api.post<RespostaIniciarTorneio>(`${URL}${id}/iniciar/`);
  return data;
}

export interface RespostaAvancarRodada {
  message: string;
  rodada_anterior: IRodada;
  nova_rodada: IRodada;
}

/** Encerra a rodada em andamento e cria a próxima já emparelhada (fase de emparelhamento). */
export async function avancarRodada(id: number): Promise<RespostaAvancarRodada> {
  const { data } = await api.post<RespostaAvancarRodada>(`${URL}${id}/proxima_rodada/`);
  return data;
}

export interface RespostaFinalizarTorneio {
  message: string;
  ranking: IJogadorRanking[];
  total_rodadas: number;
}

export async function finalizarTorneio(id: number): Promise<RespostaFinalizarTorneio> {
  const { data } = await api.post<RespostaFinalizarTorneio>(`${URL}${id}/finalizar/`);
  return data;
}

export async function cancelarTorneio(id: number): Promise<{ message: string; torneio: ITorneio }> {
  const { data } = await api.post(`${URL}${id}/cancelar/`, { confirmacao: true });
  return data;
}

/** Ranking acumulado até a rodada (com métricas de desempate se ela já terminou). */
export async function buscarRankingRodada(idTorneio: number, rodadaId: number): Promise<IRankingRodada> {
  const { data } = await api.get<IRankingRodada>(`${URL}${idTorneio}/ranking_rodada/`, {
    params: { rodada_id: rodadaId },
  });
  return data;
}

// ------------------------------------------------------------------------------
// Agrupamentos da tela "Meus ingressos / Meus eventos"
// ------------------------------------------------------------------------------

export interface TorneiosAgrupados {
  abertos: ITorneio[];
  andamento: ITorneio[];
  historico: ITorneio[];
}

function agrupar(torneios: ITorneio[], abertos: ITorneio[]): TorneiosAgrupados {
  return {
    abertos,
    andamento: torneios.filter((t) => t.status === 'Em Andamento'),
    historico: torneios.filter((t) => t.status === 'Finalizado'),
  };
}

/** LOJA: todos os torneios dela, separados por situação. */
export async function agruparTorneiosDaLoja(): Promise<TorneiosAgrupados> {
  const torneios = await buscarTorneios();
  return agrupar(
    torneios,
    torneios.filter((t) => t.status === 'Aberto'),
  );
}

/**
 * JOGADOR: torneios em que ele se inscreveu.
 * "Abertos" só considera inscrições ativas; andamento/histórico incluem quem saiu no meio.
 */
export async function agruparTorneiosDoJogador(): Promise<TorneiosAgrupados> {
  const [inscricoes, listados] = await Promise.all([listarInscricoes(), buscarTorneios()]);
  const porId = new Map(listados.map((t) => [t.id, t]));

  // A listagem esconde torneios abertos já atrasados; busca esses individualmente.
  const faltantes = inscricoes.filter((i) => !porId.has(i.id_torneio));
  const extras = await Promise.all(faltantes.map((i) => buscarTorneioPorId(i.id_torneio)));
  extras.forEach((t) => porId.set(t.id, t));

  const ativos = new Set(inscricoes.filter((i: IInscricao) => i.status === 'Inscrito').map((i) => i.id_torneio));
  const meus = inscricoes.map((i) => porId.get(i.id_torneio)).filter((t): t is ITorneio => Boolean(t));

  return agrupar(
    meus,
    meus.filter((t) => t.status === 'Aberto' && ativos.has(t.id)),
  );
}
