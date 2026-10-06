/**
 * Tipos compartilhados. Refletem exatamente o que a API (backend/) envia e recebe.
 */

// ===== Usuário =====

export type TipoUsuario = 'JOGADOR' | 'LOJA' | 'ADMIN';

export interface IUsuario {
  id: number;
  email: string;
  username: string;
  tipo: TipoUsuario;
  status: string;
  date_joined: string;
}

export interface IUsuarioCadastro {
  email: string;
  username: string;
  password: string;
  tipo: Exclude<TipoUsuario, 'ADMIN'>;
}

export interface ILoginCredenciais {
  email: string;
  password: string;
}

// ===== Torneio =====

export type StatusTorneio = 'Aberto' | 'Em Andamento' | 'Finalizado' | 'Cancelado';

export interface ITorneio {
  id: number;
  id_loja: number;
  loja_nome: string;
  loja_email: string;
  loja_tipo: TipoUsuario;
  nome: string;
  descricao: string;
  status: StatusTorneio;
  regras: string;
  banner: string;
  vagas_limitadas: boolean;
  qnt_vagas: number | null;
  qnt_inscritos: number;
  inscricao_gratuita: boolean;
  /** Decimal serializado como string (ex: "15.00"). */
  valor_inscricao: string | null;
  pontuacao_vitoria: number;
  pontuacao_derrota: number;
  pontuacao_empate: number;
  pontuacao_bye: number;
  quantidade_rodadas: number | null;
  data_inicio: string;
}

/** Campos enviados ao criar/editar um torneio (status e dono são definidos pelo backend). */
export interface ITorneioEntrada {
  nome: string;
  descricao: string;
  regras: string;
  banner: string;
  vagas_limitadas: boolean;
  qnt_vagas: number | null;
  inscricao_gratuita: boolean;
  valor_inscricao: number | null;
  pontuacao_vitoria: number;
  pontuacao_derrota: number;
  pontuacao_empate: number;
  pontuacao_bye: number;
  quantidade_rodadas: number | null;
  data_inicio: string;
}

// ===== Inscrição =====

export type StatusInscricao = 'Inscrito' | 'Cancelado';

export interface IInscricao {
  id: number;
  id_usuario: number;
  username: string;
  email: string;
  id_torneio: number;
  nome_torneio: string;
  decklist: string;
  status: StatusInscricao;
  data_inscricao: string;
}

// ===== Rodada e mesa =====

export type StatusRodada = 'Emparelhamento' | 'Em Andamento' | 'Finalizada';

export interface IRodada {
  id: number;
  id_torneio: number;
  numero_rodada: number;
  status: StatusRodada;
  data_inicio: string | null;
}

/** 0 = empate, 1 = Time 1, 2 = Time 2, null = resultado ainda não reportado. */
export type ResultadoMesa = 0 | 1 | 2 | null;

export interface IJogadorMesa {
  id: number;
  id_usuario: number;
  username: string;
  email: string;
  time: 1 | 2;
}

/** Mesa na visão geral da rodada (loja). */
export interface IMesaRodada {
  id: number;
  id_rodada: number;
  numero_rodada: number;
  nome_torneio: string;
  numero_mesa: number;
  time_vencedor: ResultadoMesa;
  pontuacao_time_1: number;
  pontuacao_time_2: number;
  jogadores: IJogadorMesa[];
}

/** Mesa vista pelo jogador que está nela. */
export interface IMesaAtiva {
  id: number;
  numero_mesa: number;
  id_torneio: number;
  nome_torneio: string;
  numero_rodada: number;
  status_rodada: StatusRodada;
  pontuacao_time_1: number;
  pontuacao_time_2: number;
  time_vencedor: ResultadoMesa;
  time_1: IJogadorMesa[];
  time_2: IJogadorMesa[];
  meu_time: 1 | 2;
}

export interface IParticipante {
  id: number;
  username: string;
  email: string;
}

// ===== Ranking =====

export interface IJogadorRanking {
  posicao: number;
  jogador_id: number;
  jogador_nome: string;
  pontos: number;
  /** Métricas de desempate: só existem para rodadas finalizadas. */
  mw_percentage?: number;
  omw_percentage?: number;
  pmw_percentage?: number;
  balanco?: number;
}

export interface IRankingRodada {
  rodada_numero: number;
  ranking: IJogadorRanking[];
}
