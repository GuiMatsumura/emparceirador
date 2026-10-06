import { useState } from 'react';
import { FiEdit } from 'react-icons/fi';

import { posicionarJogador } from '../../services/rodadaServico';
import type { IJogadorMesa, StatusRodada } from '../../tipos/tipos';
import { alertarErro } from '../../utils/alertas';
import CardResultadoMesa from '../CardResultadoMesa';
import InputSelect from '../InputSelect';
import modalStyles from '../Modal/modal.module.css';
import styles from './mesaParticipante.module.css';

export type SituacaoMesa = 'Finalizado' | 'Em andamento' | 'Revisar dados';

export interface JogadorDisponivel {
  id: number;
  username: string;
}

interface MesaCardProps {
  mesaId: number;
  numeroMesa: number;
  situacao: SituacaoMesa;
  pontuacaoTime1: number;
  pontuacaoTime2: number;
  jogadoresDaMesa: IJogadorMesa[];
  /** Jogadores que podem ser colocados nas posições (fase de emparelhamento). */
  jogadoresDisponiveis: JogadorDisponivel[];
  statusRodada: StatusRodada;
  /** Se a loja pode lançar/corrigir o placar desta mesa. */
  podeInformarResultado: boolean;
  onConfirmarResultado: (mesaId: number, pontuacaoTime1: number, pontuacaoTime2: number) => Promise<void>;
  onRecarregarMesas: () => void;
}

const VAZIO = 0;

/**
 * Mesa na visão da loja.
 * Em emparelhamento, os selects trocam os jogadores; depois disso mostram quem jogou e o placar pode ser lançado.
 */
const MesaCard = ({
  mesaId,
  numeroMesa,
  situacao,
  pontuacaoTime1,
  pontuacaoTime2,
  jogadoresDaMesa,
  jogadoresDisponiveis,
  statusRodada,
  podeInformarResultado,
  onConfirmarResultado,
  onRecarregarMesas,
}: MesaCardProps) => {
  const [resultadoAberto, setResultadoAberto] = useState(false);
  const emEmparelhamento = statusRodada === 'Emparelhamento';

  // Inclui quem já está na mesa, mesmo que tenha saído do torneio, para o select exibir o nome
  const opcoes = [
    { value: VAZIO, label: '--- Vazio ---' },
    ...[...jogadoresDisponiveis, ...jogadoresDaMesa.map((j) => ({ id: j.id_usuario, username: j.username }))]
      .filter((j, i, todos) => todos.findIndex((outro) => outro.id === j.id) === i)
      .map((j) => ({ value: j.id, label: j.username })),
  ];

  const trocarJogador = async (time: 1 | 2, posicao: 1 | 2, valor: string) => {
    const jogadorId = Number(valor) || null;
    try {
      await posicionarJogador(mesaId, time, posicao, jogadorId);
      onRecarregarMesas();
    } catch (erro) {
      alertarErro('Erro ao alterar jogador', erro);
    }
  };

  const confirmarResultado = async (time1: number, time2: number) => {
    try {
      await onConfirmarResultado(mesaId, time1, time2);
      setResultadoAberto(false);
    } catch (erro) {
      alertarErro('Não foi possível registrar o resultado', erro);
    }
  };

  return (
    <>
      <div className={styles.mesaContainer}>
        <div className={styles.header}>
          <h3 className={styles.title}>Mesa {numeroMesa}</h3>
          {podeInformarResultado && !emEmparelhamento && (
            <button className={styles.editButton} onClick={() => setResultadoAberto(true)} aria-label="Informar resultado">
              <FiEdit />
            </button>
          )}
        </div>

        <div className={styles.teamsInfo}>
          {([1, 2] as const).map((time) => {
            const jogadoresDoTime = jogadoresDaMesa.filter((j) => j.time === time);
            return (
              <div key={time} className={styles.team}>
                <div className={styles.teamHeader}>
                  <span className={styles.teamLabel}>Time {time}:</span>
                </div>
                {([1, 2] as const).map((posicao) => (
                  <div key={posicao} className={styles.teamPlayers}>
                    <InputSelect
                      name={`mesa-${mesaId}-time-${time}-${posicao}`}
                      value={jogadoresDoTime[posicao - 1]?.id_usuario ?? VAZIO}
                      onChange={(e) => trocarJogador(time, posicao, e.target.value)}
                      options={opcoes}
                      readOnly={!emEmparelhamento}
                    />
                  </div>
                ))}
              </div>
            );
          })}

          {!emEmparelhamento && (
            <div className={styles.statusContainer}>
              <span className={`${styles.status} ${styles[situacao.toLowerCase().replace(' ', '')]}`}>{situacao}</span>
            </div>
          )}
        </div>
      </div>

      {resultadoAberto && (
        <div className={modalStyles.modalOverlay} onClick={() => setResultadoAberto(false)}>
          <div className={modalStyles.modalContent} onClick={(e) => e.stopPropagation()}>
            <CardResultadoMesa
              pontuacaoInicialTime1={pontuacaoTime1}
              pontuacaoInicialTime2={pontuacaoTime2}
              onSubmit={confirmarResultado}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default MesaCard;
