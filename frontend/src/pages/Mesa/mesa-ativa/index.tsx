import { useCallback, useEffect, useState } from 'react';
import { BsGrid3X3Gap } from 'react-icons/bs';
import { GiPodium } from 'react-icons/gi';

import Button from '../../../components/Button';
import CardRanking from '../../../components/CardRanking';
import RegrasPartida from '../../../components/CardRegrasPartida';
import { CardSuperior } from '../../../components/CardSuperior';
import Input from '../../../components/Input';
import { useSessao } from '../../../contextos/AuthContexto';
import { useIntervalo } from '../../../hooks/useIntervalo';
import { buscarMinhaMesaNaRodada, reportarResultadoMesa } from '../../../services/mesaServico';
import { buscarTorneioPorId } from '../../../services/torneioServico';
import type { IMesaAtiva, ITorneio } from '../../../tipos/tipos';
import { alertarAviso, alertarErro, alertarSucesso, avisoRapido } from '../../../utils/alertas';
import styles from '../styles.module.css';

const INTERVALO_ATUALIZACAO_MS = 30_000;

interface MesaAtivaProps {
  rodadaId: number;
  torneioId: number;
  /** Chamado quando o resultado foi enviado ou a rodada foi encerrada pela loja. */
  onMesaFinalizada: () => void;
  onVoltarParaIntervalo: () => void;
}

/** Mesa do jogador durante a rodada: disposição dos jogadores e envio do placar. */
export default function MesaAtivaComponent({ rodadaId, torneioId, onMesaFinalizada, onVoltarParaIntervalo }: MesaAtivaProps) {
  const { usuario } = useSessao();
  const [mesa, setMesa] = useState<IMesaAtiva | null>(null);
  const [torneio, setTorneio] = useState<ITorneio | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportandoResultado, setReportandoResultado] = useState(false);
  const [vitoriasSuaDupla, setVitoriasSuaDupla] = useState('');
  const [vitoriasOponentes, setVitoriasOponentes] = useState('');

  const carregarMesa = useCallback(async () => {
    const dados = await buscarMinhaMesaNaRodada(rodadaId);
    // Sem mesa (bye) ou rodada já encerrada: não há o que fazer aqui
    if (!dados || dados.status_rodada === 'Finalizada') {
      onMesaFinalizada();
      return null;
    }
    setMesa(dados);
    return dados;
  }, [rodadaId, onMesaFinalizada]);

  useEffect(() => {
    const iniciar = async () => {
      try {
        const [dados, dadosTorneio] = await Promise.all([carregarMesa(), buscarTorneioPorId(torneioId)]);
        setTorneio(dadosTorneio);
        if (dados) {
          const meu = dados.meu_time === 1 ? dados.pontuacao_time_1 : dados.pontuacao_time_2;
          const deles = dados.meu_time === 1 ? dados.pontuacao_time_2 : dados.pontuacao_time_1;
          setVitoriasSuaDupla(String(meu));
          setVitoriasOponentes(String(deles));
        }
      } catch (erro) {
        alertarErro('Não foi possível carregar a mesa', erro);
        onVoltarParaIntervalo();
      } finally {
        setLoading(false);
      }
    };
    iniciar();
    // Carrega uma vez ao abrir a mesa; atualizações vêm do polling abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodadaId, torneioId]);

  // Se a loja encerrar a rodada enquanto o jogador está aqui, volta para o intervalo
  useIntervalo(async () => {
    try {
      const dados = await buscarMinhaMesaNaRodada(rodadaId);
      if (!dados || dados.status_rodada === 'Finalizada') {
        avisoRapido('Rodada finalizada pelo organizador');
        onMesaFinalizada();
      } else if (mesa && dados.time_vencedor !== mesa.time_vencedor) {
        setMesa(dados);
        avisoRapido('O resultado da sua mesa foi atualizado');
      }
    } catch {
      // Falha pontual no polling: tenta de novo no próximo ciclo
    }
  }, INTERVALO_ATUALIZACAO_MS);

  const handleReportarResultado = async () => {
    if (!mesa) return;
    const nossas = parseInt(vitoriasSuaDupla, 10);
    const deles = parseInt(vitoriasOponentes, 10);
    if (Number.isNaN(nossas) || Number.isNaN(deles) || nossas < 0 || deles < 0) {
      alertarAviso('Atenção', 'Informe o número de vitórias das duas duplas.');
      return;
    }

    const [pontuacaoTime1, pontuacaoTime2] = mesa.meu_time === 1 ? [nossas, deles] : [deles, nossas];
    try {
      setReportandoResultado(true);
      await reportarResultadoMesa(mesa.id, pontuacaoTime1, pontuacaoTime2);
      await alertarSucesso('Resultado reportado com sucesso!');
      onMesaFinalizada();
    } catch (erro) {
      alertarErro('Não foi possível reportar o resultado', erro);
    } finally {
      setReportandoResultado(false);
    }
  };

  if (loading) {
    return <div className={styles.container}><div className={styles.loading}>Carregando...</div></div>;
  }

  if (!mesa) {
    return <div className={styles.container}><div className={styles.error}>Mesa não encontrada</div></div>;
  }

  // Identificar você e sua dupla
  const meuTime = mesa.meu_time === 1 ? mesa.time_1 : mesa.time_2;
  const timeAdversario = mesa.meu_time === 1 ? mesa.time_2 : mesa.time_1;

  // Separar você da sua dupla baseado no id_usuario do usuário logado
  const voce = meuTime.find(j => j.id_usuario === usuario?.id) || meuTime[0];
  const suaDupla = meuTime.find(j => j.id_usuario !== usuario?.id) || meuTime[1];

  return (
    <div className={styles.container}>
      {/* CABEÇALHO */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>
            Mesa Ativa
          </h1>
          <p className={styles.subtitulo}>
            {mesa.nome_torneio}
          </p>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div className={styles.gridContainer}>
        <div className={styles.colunaEsquerda}>
          {/* Cards Superiores */}
          <div className={styles.cardsEsquerda}>
            <CardSuperior
              count={mesa.numero_mesa}
              label="Sua Mesa"
              icon={BsGrid3X3Gap}
              selected={false}
            />
            <CardSuperior
              count={mesa.numero_rodada}
              secondaryCount={torneio?.quantidade_rodadas || undefined}
              label="Rodada"
              icon={GiPodium}
              selected={false}
            />
          </div>

          {/* Sua Partida */}
          <div className={styles.partidaCard}>
            <h2 className={styles.cardTitulo}>Sua Partida - Mesa {mesa.numero_mesa}</h2>
            <p className={styles.statusPartida}>Disposição da Mesa</p>
            <p className={styles.descricaoMesa}>Você está sentado em frente ao adversário e na diagonal da sua dupla</p>

            {/* Layout da Mesa */}
            <div className={styles.mesaLayout}>
              {/* Linha Superior: VOCÊ e ADV1 */}
              <div className={styles.posicaoTopoEsquerda}>
                <div className={`${styles.jogadorCard} ${styles.voce}`}>
                  <div className={styles.jogadorNome}>{voce?.username || 'Você'}</div>
                  <div className={styles.jogadorPosicao}>Você</div>
                </div>
              </div>

              <div className={styles.posicaoTopoDireita}>
                <div className={`${styles.jogadorCard} ${styles.adversario}`}>
                  <div className={styles.jogadorNome}>{timeAdversario[0]?.username || 'Adversário'}</div>
                  <div className={styles.jogadorPosicao}>À sua frente</div>
                </div>
              </div>

              {/* Centro da Mesa */}
              <div className={styles.centroMesa}>
                <div className={styles.mesaIcone}>🎴</div>
                <div className={styles.mesaTexto}>MESA</div>
              </div>

              {/* Linha Inferior: ADV2 e SUA DUPLA */}
              <div className={styles.posicaoBaseEsquerda}>
                <div className={`${styles.jogadorCard} ${styles.adversario}`}>
                  <div className={styles.jogadorNome}>{timeAdversario[1]?.username || 'Adversário'}</div>
                  <div className={styles.jogadorPosicao}>Ao seu lado</div>
                </div>
              </div>

              <div className={styles.posicaoBaseDireita}>
                <div className={`${styles.jogadorCard} ${styles.dupla}`}>
                  <div className={styles.jogadorNome}>{suaDupla?.username || 'Sua Dupla'}</div>
                  <div className={styles.jogadorPosicao}>Sua Dupla</div>
                </div>
              </div>
            </div>

            {/* Legenda das Duplas */}
            <div className={styles.legendaDuplas}>
              <div className={styles.legendaItem}>
                <span className={`${styles.legendaCor} ${styles.corVoce}`}></span>
                <span>Sua Dupla: {voce?.username} & {suaDupla?.username}</span>
              </div>
              <div className={styles.legendaItem}>
                <span className={`${styles.legendaCor} ${styles.corAdversario}`}></span>
                <span>Adversários: {timeAdversario.map(j => j.username).join(' & ')}</span>
              </div>
            </div>
          </div>

          {/* Informar Resultado */}
          <div className={styles.resultadoCard}>
            <h2 className={styles.cardTitulo}>Informar Resultado da Rodada</h2>
            <p className={styles.instrucao}>
              Informe a quantas vitórias e empates sua dupla teve ao final da partida
            </p>

            <div className={styles.inputsResultado}>
              <div className={styles.inputGroup}>
                <p className={styles.inputLabel}>Sua Dupla</p>
                <Input
                  type="numero"
                  name="vitorias_sua_dupla"
                  label="Vitórias"
                  value={vitoriasSuaDupla}
                  onChange={(e) => setVitoriasSuaDupla(e.target.value)}
                  backgroundColor="var(--var-cor-azul-fundo-section)"
                  textColor="var(--var-cor-branca)"
                  labelColor="var(--var-cor-branca)"
                />
              </div>
              <div className={styles.inputGroup}>
                <p className={styles.inputLabel}>Dupla Adversária</p>
                <Input
                  type="numero"
                  name="vitorias_oponentes"
                  label="Vitórias"
                  value={vitoriasOponentes}
                  onChange={(e) => setVitoriasOponentes(e.target.value)}
                  backgroundColor="var(--var-cor-azul-fundo-section)"
                  textColor="var(--var-cor-branca)"
                  labelColor="var(--var-cor-branca)"
                />
              </div>
            </div>

            <Button
              label="Confirmar Resultado"
              type="button"
              onClick={handleReportarResultado}
              disabled={reportandoResultado}
            />

            {/* Botão para voltar ao intervalo */}
            <Button
              label="Voltar"
              type="button"
              onClick={onVoltarParaIntervalo}
              backgroundColor="var(--var-cor-secundaria)"
            />
          </div>
        </div>

        {/* COLUNA DIREITA - Ranking e Regras */}
        <div className={styles.colunaDireita}>
          {/* Ranking da Rodada */}
          <CardRanking
            tournamentId={torneioId}
            rodadaId={rodadaId}
            titulo={`🏆 Ranking - Rodada ${mesa.numero_rodada}`}
            subtitulo="Pontuação acumulada com métricas avançadas"
            mostrarMetricasAvancadas={true}
          />

          {/* Regras da Partida */}
          {torneio?.regras && <RegrasPartida regras={torneio.regras} />}
        </div>
      </div>
    </div>
  );
}