import { useCallback, useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';

import { listarInscricoes, reativarInscricao, retirarInscricao } from '../../services/inscricaoServico';
import type { IInscricao, StatusTorneio } from '../../tipos/tipos';
import { alertarErro, CORES, confirmar } from '../../utils/alertas';
import styles from '../Modal/modal.module.css';

interface ModalGerenciarInscricoesProps {
  torneioId: number;
  torneioStatus: StatusTorneio;
  onClose: () => void;
  /** Chamado após qualquer alteração, para a página recarregar seus dados. */
  onAlterado?: () => void;
}

/** Loja ativa/desativa a inscrição de cada jogador do torneio. */
const ModalGerenciarInscricoes = ({ torneioId, torneioStatus, onClose, onAlterado }: ModalGerenciarInscricoesProps) => {
  const [carregando, setCarregando] = useState(true);
  const [inscricoes, setInscricoes] = useState<IInscricao[]>([]);
  const [atualizando, setAtualizando] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setInscricoes(await listarInscricoes(torneioId));
    } catch (erro) {
      alertarErro('Não foi possível carregar as inscrições', erro);
    } finally {
      setCarregando(false);
    }
  }, [torneioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const alternar = async (inscricao: IInscricao) => {
    const ativa = inscricao.status === 'Inscrito';
    const confirmou = await confirmar(
      ativa
        ? {
            titulo: `Remover ${inscricao.username} deste torneio?`,
            texto: 'A inscrição deste jogador será cancelada.',
            icone: 'warning',
            confirmar: 'Remover',
            corConfirmar: CORES.perigo,
          }
        : {
            titulo: `Reinscrever ${inscricao.username}?`,
            texto: 'A inscrição deste jogador será reativada.',
            confirmar: 'Reinscrever',
          },
    );
    if (!confirmou) return;

    setAtualizando(inscricao.id);
    try {
      if (ativa) {
        await retirarInscricao(inscricao.id, torneioStatus);
      } else {
        await reativarInscricao(inscricao.id);
      }
      await carregar();
      onAlterado?.();
    } catch (erro) {
      alertarErro(ativa ? 'Não foi possível remover o jogador' : 'Não foi possível reinscrever o jogador', erro);
    } finally {
      setAtualizando(null);
    }
  };

  const renderizarConteudo = () => {
    if (carregando) return <div className={styles.infoText}>Carregando jogadores…</div>;
    if (!inscricoes.length) return <div className={styles.infoText}>Nenhum jogador inscrito.</div>;
    return (
      <ul className={styles.listaWrapper}>
        {inscricoes.map((inscricao) => (
          <li key={inscricao.id} className={styles.linhaJogador}>
            <span className={styles.nomeJogador}>
              {inscricao.username} ({inscricao.email})
            </span>
            <label className={styles.switchWrapper}>
              <input
                type="checkbox"
                checked={inscricao.status === 'Inscrito'}
                disabled={atualizando === inscricao.id}
                onChange={() => alternar(inscricao)}
              />
              <span className={styles.slider} />
            </label>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.headerRow}>
          <h2 className={styles.modalTitulo}>Gerenciar Inscrições</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Fechar">
            <FiX size={20} />
          </button>
        </div>

        <div className={styles.scrollArea}>{renderizarConteudo()}</div>

        <div className={styles.footerRow}>
          <button className={styles.actionSecondary} onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalGerenciarInscricoes;
