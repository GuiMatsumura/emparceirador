import { useEffect, useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import styles from './styles.module.css';
import { buscarRodadasDoTorneio } from "../../services/rodadaServico";
import type { IRodada } from "../../tipos/tipos";

interface DropdownRodadasProps {
  tournamentId?: number;
  rodadaSelecionada: IRodada | null;
  onSelecionarRodada: (rodada: IRodada) => void;
  onSelecionarResultadoFinal?: () => void;
  resultadoFinalSelecionado?: boolean;
  tournamentStatus?: string;
  className?: string;
}

const DropdownRodadas: React.FC<DropdownRodadasProps> = ({
  tournamentId,
  rodadaSelecionada,
  onSelecionarRodada,
  onSelecionarResultadoFinal,
  resultadoFinalSelecionado = false,
  tournamentStatus,
  className = ''
}) => {
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [rodadas, setRodadas] = useState<IRodada[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Callbacks do pai em refs: a seleção automática roda só quando o torneio muda,
  // mesmo que o pai recrie as funções a cada render.
  const aoSelecionarRodada = useRef(onSelecionarRodada);
  const aoSelecionarFinal = useRef(onSelecionarResultadoFinal);
  useEffect(() => {
    aoSelecionarRodada.current = onSelecionarRodada;
    aoSelecionarFinal.current = onSelecionarResultadoFinal;
  });

  // Carrega as rodadas e seleciona automaticamente a última (ou o resultado final, se o torneio acabou)
  useEffect(() => {
    if (!tournamentId) return;
    let ativo = true;
    setCarregando(true);
    buscarRodadasDoTorneio(tournamentId)
      .then((dados) => {
        if (!ativo) return;
        setRodadas(dados);
        if (!dados.length) return;
        if (tournamentStatus === 'Finalizado' && aoSelecionarFinal.current) {
          aoSelecionarFinal.current();
        } else {
          aoSelecionarRodada.current(dados[dados.length - 1]);
        }
      })
      .catch(() => ativo && setRodadas([]))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [tournamentId, tournamentStatus]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.${styles.dropdownContainer}`)) {
        setDropdownAberto(false);
      }
    };

    if (dropdownAberto) {
      document.addEventListener('click', handleClickFora);
    }

    return () => {
      document.removeEventListener('click', handleClickFora);
    };
  }, [dropdownAberto]);

  return (
    <div className={`${styles.dropdownContainer} ${className}`}>
      <button
        className={styles.dropdownButton}
        onClick={() => setDropdownAberto(!dropdownAberto)}
        disabled={carregando}
      >
        <span>
          {carregando ? (
            'Carregando rodadas...'
          ) : resultadoFinalSelecionado ? (
            '🏆 Resultado final'
          ) : rodadaSelecionada ? (
            `Rodada ${rodadaSelecionada.numero_rodada} de ${rodadas.length}`
          ) : rodadas.length > 0 ? (
            'Selecione uma rodada'
          ) : (
            'Nenhuma rodada disponível'
          )}
        </span>
        <FiChevronDown className={dropdownAberto ? styles.iconRotate : ''} />
      </button>

      {dropdownAberto && !carregando && (
        <div className={styles.dropdownMenu}>
          {rodadas.map((rodada) => (
            <div
              key={rodada.id}
              className={`${styles.dropdownItem} ${
                rodadaSelecionada?.id === rodada.id && !resultadoFinalSelecionado ? styles.itemAtivo : ''
              }`}
              onClick={() => {
                onSelecionarRodada(rodada);
                setDropdownAberto(false);
              }}
            >
              <span>Rodada {rodada.numero_rodada}</span>
              <span className={styles.statusRodada}>
                {rodada.status}
              </span>
            </div>
          ))}
          
          {tournamentStatus === "Finalizado" && onSelecionarResultadoFinal && rodadas.length > 0 && (
            <div
              className={`${styles.dropdownItem} ${
                resultadoFinalSelecionado ? styles.itemAtivo : ''
              } ${styles.resultadoFinalItem}`}
              onClick={() => {
                onSelecionarResultadoFinal();
                setDropdownAberto(false);
              }}
            >
              <span className={styles.resultadoFinalText}>🏆 Resultado final</span>
              <span className={styles.statusRodada}>Final</span>
            </div>
          )}
          
          {rodadas.length === 0 && !carregando && (
            <div className={styles.dropdownItem}>
              <span>Nenhuma rodada disponível</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DropdownRodadas;