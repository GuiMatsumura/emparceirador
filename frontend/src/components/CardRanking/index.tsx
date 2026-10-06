import { useEffect, useState } from "react";

import { buscarRodadasDoTorneio } from "../../services/rodadaServico";
import { buscarRankingRodada } from "../../services/torneioServico";
import type { IJogadorRanking } from "../../tipos/tipos";
import styles from './styles.module.css';

interface RankingProps {
  tournamentId?: number;
  /** Rodada até a qual o ranking é acumulado. Se omitida com isRankingFinal, usa a última rodada. */
  rodadaId?: number;
  isRankingFinal?: boolean;
  titulo?: string;
  subtitulo?: string;
  limite?: number;
  className?: string;
  mostrarMetricasAvancadas?: boolean;
}

const CardRanking: React.FC<RankingProps> = ({
  tournamentId,
  rodadaId,
  isRankingFinal = false,
  titulo = "🏆 Ranking",
  subtitulo,
  limite,
  className = '',
  mostrarMetricasAvancadas = false,
}) => {
  const [ranking, setRanking] = useState<IJogadorRanking[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!tournamentId) {
      setRanking([]);
      return;
    }
    // Evita que uma resposta antiga sobrescreva a da seleção atual
    let ativo = true;

    const carregar = async () => {
      setCarregando(true);
      setErro(null);
      try {
        let alvo = rodadaId;
        if (!alvo && isRankingFinal) {
          const rodadas = await buscarRodadasDoTorneio(tournamentId);
          alvo = rodadas.at(-1)?.id;
        }
        const dados = alvo ? (await buscarRankingRodada(tournamentId, alvo)).ranking : [];
        if (ativo) setRanking(dados);
      } catch {
        if (ativo) {
          setErro('Erro ao carregar ranking');
          setRanking([]);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    carregar();
    return () => {
      ativo = false;
    };
  }, [tournamentId, rodadaId, isRankingFinal]);

  const getClassePosicao = (posicao: number) => {
    if (posicao === 1) return styles.medalhaOuro;
    if (posicao === 2) return styles.medalhaPrata;
    if (posicao === 3) return styles.medalhaBronze;
    return '';
  };

  const getEmojiPosicao = (posicao: number) => {
    if (posicao === 1) return '🥇';
    if (posicao === 2) return '🥈';
    if (posicao === 3) return '🥉';
    return null;
  };

  // Formata porcentagem para exibição
  const formatarPorcentagem = (valor?: number): string => {
    if (valor === undefined || valor === null) return '-';
    return `${(valor * 100).toFixed(1)}%`;
  };

  // Formata balanço com sinal
  const formatarBalanco = (valor?: number): string => {
    if (valor === undefined || valor === null) return '-';
    const formatado = (valor * 100).toFixed(1);
    return valor >= 0 ? `+${formatado}%` : `${formatado}%`;
  };

  // Retorna classe CSS baseada no balanço
  const getClasseBalanco = (balanco?: number) => {
    if (balanco === undefined || balanco === null) return '';
    if (balanco > 0.05) return styles.balancoPositivo;
    if (balanco < -0.05) return styles.balancoNegativo;
    return styles.balancoNeutro;
  };

  // Retorna ícone baseado no balanço
  const getIconeBalanco = (balanco?: number) => {
    if (balanco === undefined || balanco === null) return '';
    if (balanco > 0.05) return '↑';
    if (balanco < -0.05) return '↓';
    return '≈';
  };

  // Verifica se há métricas avançadas nos dados
  const temMetricasAvancadas = ranking.length > 0 && ranking[0].mw_percentage !== undefined;

  const containerClass = `${styles.container} ${className} ${
    isRankingFinal ? styles.rankingFinal : styles.rankingParcial
  }`;

  // Se não há limite definido, mostrar todos para ranking final
  const rankingParaExibir = limite ? ranking.slice(0, limite) : ranking;

  return (
    <div className={containerClass}>
      <h2 className={styles.titulo}>{titulo}</h2>
      
      {subtitulo && <div className={styles.subtitulo}>{subtitulo}</div>}
      
      {!subtitulo && !isRankingFinal && rodadaId && (
        <div className={styles.subtitulo}>
          Pontuação acumulada
        </div>
      )}

      {!subtitulo && isRankingFinal && (
        <div className={styles.subtitulo}>
          Classificação final do torneio
        </div>
      )}

      {carregando ? (
        <div className={styles.loading}>Carregando ranking...</div>
      ) : erro ? (
        <div className={styles.erro}>{erro}</div>
      ) : rankingParaExibir.length > 0 ? (
        <div className={styles.rankingContainer}>
          {rankingParaExibir.map((jogador) => {
            const emoji = getEmojiPosicao(jogador.posicao);
            const classePosicao = getClassePosicao(jogador.posicao);
            const classeBalanco = getClasseBalanco(jogador.balanco);
            const iconeBalanco = getIconeBalanco(jogador.balanco);

            return (
              <div key={jogador.jogador_id} className={styles.rankingItem}>
                <div className={`${styles.rankingPosicao} ${classePosicao}`}>
                  {emoji || <span>{jogador.posicao}º</span>}
                </div>
                <div className={styles.rankingInfo}>
                  <div className={styles.rankingHeader}>
                    <span className={styles.rankingNome}>{jogador.jogador_nome}</span>
                    <span className={styles.rankingPontos}>{jogador.pontos} pts</span>
                  </div>

                  {/* Métricas avançadas - só mostra se estiver habilitado E tiver dados */}
                  {(mostrarMetricasAvancadas && temMetricasAvancadas) && jogador.mw_percentage !== undefined && (
                    <div className={styles.metricas}>
                      <div
                        className={`${styles.metricaItem} ${styles.metricaBalanco} ${classeBalanco}`}
                        title="Balanço (OMW% - PMW%) - Mérito individual. Positivo = venceu com parceiros fracos. Negativo = teve parceiros fortes."
                      >
                        <span className={styles.metricaLabel}>Balanço:</span>
                        <span className={styles.metricaValor}>
                          <span className={styles.iconeBalanco}>{iconeBalanco}</span>
                          {formatarBalanco(jogador.balanco)}
                        </span>
                      </div>

                      <div className={styles.metricaItem} title="Opponent Match Win % - Força dos seus oponentes">
                        <span className={styles.metricaLabel}>OMW%:</span>
                        <span className={styles.metricaValor}>{formatarPorcentagem(jogador.omw_percentage)}</span>
                      </div>

                      <div className={styles.metricaItem} title="Match Win % - Seu aproveitamento individual">
                        <span className={styles.metricaLabel}>MW%:</span>
                        <span className={styles.metricaValor}>{formatarPorcentagem(jogador.mw_percentage)}</span>
                      </div>

                      <div className={styles.metricaItem} title="Partner Match Win % - Força dos seus parceiros">
                        <span className={styles.metricaLabel}>PMW%:</span>
                        <span className={styles.metricaValor}>{formatarPorcentagem(jogador.pmw_percentage)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.mensagemVazia}>
          {tournamentId && (rodadaId || isRankingFinal)
            ? 'Nenhum ranking disponível.' 
            : 'Selecione uma rodada para visualizar o ranking'
          }
        </div>
      )}
    </div>
  );
};

export default CardRanking;