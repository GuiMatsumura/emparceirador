import { useCallback, useEffect, useState } from 'react';
import { FiCalendar, FiStar, FiUser } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import Button from '../../../components/Button';
import CardInfoTorneio from '../../../components/CardInfoTorneio';
import { CardSuperior } from '../../../components/CardSuperior';
import ModalInscricaoJogador from '../../../components/ModalInscricaoJogador';
import { useSessao } from '../../../contextos/AuthContexto';
import { sairDoTorneio } from '../../../services/inscricaoServico';
import {
  agruparTorneiosDaLoja,
  agruparTorneiosDoJogador,
  type TorneiosAgrupados,
} from '../../../services/torneioServico';
import type { ITorneio } from '../../../tipos/tipos';
import { alertarErro, alertarSucesso, confirmar } from '../../../utils/alertas';
import { mensagemDeErro } from '../../../utils/erros';
import { formatarData, formatarHora, formatarPreco } from '../../../utils/formatacao';
import styles from './styles.module.css';

type Aba = 'inscritos' | 'andamento' | 'historico';

const VAZIO: TorneiosAgrupados = { abertos: [], andamento: [], historico: [] };

const TEXTOS = {
  loja: {
    inscritos: { titulo: 'Seus Torneios', subtitulo: 'Acompanhe seus torneios e crie batalhas épicas!' },
    andamento: { titulo: 'Torneios em Andamento', subtitulo: 'Acompanhe seus torneios em andamento e as suas batalhas' },
    historico: { titulo: 'Histórico', subtitulo: 'Reviva os momentos épicos dos seus torneios passados' },
  },
  jogador: {
    inscritos: {
      titulo: 'Torneios Inscritos',
      subtitulo: 'Acompanhe seus torneios inscritos e participe das batalhas épicas',
    },
    andamento: { titulo: 'Torneios em Andamento', subtitulo: 'Acompanhe seus torneios em andamento e as suas batalhas' },
    historico: { titulo: 'Histórico de Torneios', subtitulo: 'Reviva os momentos épicos dos seus torneios passados' },
  },
} as const;

const MENSAGEM_VAZIA: Record<Aba, string> = {
  inscritos: 'Você não está inscrito em nenhum torneio no momento.',
  andamento: 'Nenhum torneio em andamento.',
  historico: 'Nenhum torneio no histórico.',
};

/** "Meus ingressos" (jogador) / "Meus eventos" (loja): torneios separados por situação. */
const HistoricoTorneios = () => {
  const { usuario } = useSessao();
  const navigate = useNavigate();
  const ehLoja = usuario?.tipo === 'LOJA';
  const textos = ehLoja ? TEXTOS.loja : TEXTOS.jogador;

  const [aba, setAba] = useState<Aba>('inscritos');
  const [grupos, setGrupos] = useState<TorneiosAgrupados>(VAZIO);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [saindoDe, setSaindoDe] = useState<number | null>(null);
  const [torneioParaInscrever, setTorneioParaInscrever] = useState<ITorneio | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setGrupos(await (ehLoja ? agruparTorneiosDaLoja() : agruparTorneiosDoJogador()));
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível carregar os torneios.'));
    } finally {
      setCarregando(false);
    }
  }, [ehLoja]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const listas: Record<Aba, ITorneio[]> = {
    inscritos: grupos.abertos,
    andamento: grupos.andamento,
    historico: grupos.historico,
  };
  const listaAtiva = listas[aba];

  const abrirTorneio = (torneio: ITorneio) => {
    // Jogador acompanha torneios iniciados pela tela de intervalo/mesa
    if (!ehLoja && aba !== 'inscritos') {
      navigate(`/intervalo/${torneio.id}`);
    } else {
      navigate(`/torneios/${torneio.id}`, { state: { aba } });
    }
  };

  const sair = async (torneio: ITorneio) => {
    const confirmou = await confirmar({
      titulo: `Desinscrever-se do torneio "${torneio.nome}"?`,
      confirmar: 'Sim, desinscrever',
      cancelar: 'Não',
    });
    if (!confirmou) return;

    setSaindoDe(torneio.id);
    try {
      await sairDoTorneio(torneio.id, torneio.status);
      await alertarSucesso('Desinscrição concluída', 'Você foi desinscrito do torneio com sucesso.');
      carregar();
    } catch (e) {
      alertarErro('Erro ao desinscrever', e);
    } finally {
      setSaindoDe(null);
    }
  };

  const acaoDoCard = (torneio: ITorneio) => {
    if (aba !== 'inscritos') return null;
    if (ehLoja) {
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            label="+ Inscrever Jogador"
            onClick={() => setTorneioParaInscrever(torneio)}
            backgroundColor="var(--var-cor-primaria)"
            textColor="var(--var-cor-branca)"
            className={styles.btnInscrever}
          />
        </div>
      );
    }
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <Button
          label={saindoDe === torneio.id ? 'Desinscrevendo...' : 'Desinscrever-se'}
          onClick={() => sair(torneio)}
          disabled={saindoDe === torneio.id}
          backgroundColor="var(--var-cor-primaria)"
          textColor="var(--var-cor-branca)"
          className={styles.btnDesinscrever}
        />
      </div>
    );
  };

  const tituloDoCard = (torneio: ITorneio) => {
    if (torneio.status === 'Em Andamento') return 'Em andamento';
    if (torneio.status === 'Finalizado') return 'Concluído';
    return ehLoja ? 'Aberto' : 'Inscrito';
  };

  const abas: { id: Aba; icone: typeof FiUser; rotulo: string }[] = [
    { id: 'inscritos', icone: FiUser, rotulo: ehLoja ? 'Seus Torneios' : 'Torneios Inscritos' },
    { id: 'andamento', icone: FiStar, rotulo: 'Em Andamento' },
    { id: 'historico', icone: FiCalendar, rotulo: 'Histórico' },
  ];

  const renderizarLista = () => {
    if (carregando) return <div className={styles.vazio}>Carregando…</div>;
    if (erro) return <div className={styles.vazio}>{erro}</div>;
    if (!listaAtiva.length) return <div className={styles.vazio}>{MENSAGEM_VAZIA[aba]}</div>;
    return (
      <div className={styles.lista}>
        {listaAtiva.map((torneio) => (
          <CardInfoTorneio
            key={torneio.id}
            title={tituloDoCard(torneio)}
            name={torneio.nome}
            date={formatarData(torneio.data_inicio)}
            time={formatarHora(torneio.data_inicio)}
            location={torneio.loja_nome}
            price={formatarPreco(torneio.inscricao_gratuita, torneio.valor_inscricao)}
            players={torneio.qnt_inscritos}
            hidePlayers={!ehLoja}
            tournamentId={torneio.id}
            action={acaoDoCard(torneio)}
            onClick={() => abrirTorneio(torneio)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.conteudo}>
        <h1 className={styles.titulo}>{textos[aba].titulo}</h1>
        <p className={styles.subtitulo}>{textos[aba].subtitulo}</p>

        <div className={styles.cardsContainer} role="tablist">
          {abas.map(({ id, icone, rotulo }) => (
            <button
              key={id}
              type="button"
              className={styles.kpiBtn}
              role="tab"
              onClick={() => setAba(id)}
              aria-selected={aba === id}
            >
              <CardSuperior
                icon={icone}
                count={listas[id].length}
                label={rotulo}
                className={styles.card}
                selected={aba === id}
              />
            </button>
          ))}
        </div>

        <section className={styles.secao} aria-live="polite">
          <h2 className={styles.secaoTitulo}>{abas.find((a) => a.id === aba)?.rotulo}</h2>
          {renderizarLista()}
        </section>
      </div>

      {torneioParaInscrever && (
        <ModalInscricaoJogador
          torneioId={torneioParaInscrever.id}
          torneioNome={torneioParaInscrever.nome}
          onClose={() => setTorneioParaInscrever(null)}
          onSuccess={carregar}
        />
      )}
    </div>
  );
};

export default HistoricoTorneios;
