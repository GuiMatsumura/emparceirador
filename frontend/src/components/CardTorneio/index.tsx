import type { MouseEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSessao } from '../../contextos/AuthContexto';
import { buscarMinhaInscricao } from '../../services/inscricaoServico';
import styles from './styles.module.css';

interface Tag {
  texto: string;
  icone?: ReactNode;
}

interface CardTorneioProps {
  id: number;
  imagem: string;
  titulo: string;
  /** Data e hora já formatadas. */
  data: string;
  hora: string;
  tags?: Tag[];
  /** Se informado, mostra o botão "+ Inscrever Jogador" (uso da loja). */
  onInscreverJogador?: () => void;
}

/** Card de torneio da home. O destino do clique depende de quem está logado. */
const CardTorneio = ({ id, imagem, titulo, data, hora, tags = [], onInscreverJogador }: CardTorneioProps) => {
  const navigate = useNavigate();
  const { usuario } = useSessao();

  const abrir = async () => {
    const paginaInscricao = `/inscricao-torneio/${id}`;
    if (!usuario) {
      navigate('/login/', { state: { from: { pathname: paginaInscricao } } });
      return;
    }
    if (usuario.tipo !== 'JOGADOR') {
      navigate(`/torneios/${id}`);
      return;
    }
    const inscricao = await buscarMinhaInscricao(id).catch(() => null);
    navigate(inscricao?.status === 'Inscrito' ? `/torneios/${id}` : paginaInscricao);
  };

  const inscreverJogador = (e: MouseEvent) => {
    e.stopPropagation();
    onInscreverJogador?.();
  };

  return (
    <div className={styles.card} onClick={abrir} style={{ cursor: 'pointer' }}>
      <div className={styles.imagemWrapper}>
        <img src={imagem} alt={titulo} className={styles.imagem} />
        <div className={styles.degrade}></div>
      </div>

      <div className={styles.conteudo}>
        <h3 className={styles.titulo}>{titulo}</h3>
        <p className={styles.data}>
          {data} • {hora}
        </p>

        <div className={styles.tags}>
          {tags.map((tag) => (
            <div key={tag.texto} className={styles.tag} style={{ backgroundColor: '#334155' }}>
              {tag.icone && <span className={styles.icone}>{tag.icone}</span>}
              <span>{tag.texto}</span>
            </div>
          ))}
        </div>

        {onInscreverJogador && (
          <button className={styles.btnInscrever} onClick={inscreverJogador}>
            + Inscrever Jogador
          </button>
        )}
      </div>
    </div>
  );
};

export default CardTorneio;
