/**
 * Gestão do torneio pela loja: inscritos (antes de começar), mesas e emparelhamento de cada rodada,
 * lançamento de resultados, ranking e ações do ciclo de vida (iniciar, avançar, finalizar...).
 */
import { useEffect, useState } from 'react';
import { FiChevronDown, FiTrash2 } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';

import MesaCard, { type SituacaoMesa } from '../../../components/CardMesaParticipante';
import CardInfoTorneio from '../../../components/CardInfoTorneio';
import CardRanking from '../../../components/CardRanking';
import RegrasPartida from '../../../components/CardRegrasPartida';
import ModalGerenciarInscricoes from '../../../components/ModalGerenciarInscricoes';
import ModalInscricaoJogador from '../../../components/ModalInscricaoJogador';
import { retirarInscricao } from '../../../services/inscricaoServico';
import { editarResultadoMesa } from '../../../services/mesaServico';
import type { IInscricao, IMesaRodada, IRodada } from '../../../tipos/tipos';
import { alertarErro, CORES, confirmar } from '../../../utils/alertas';
import { formatarData, formatarHora, formatarPreco } from '../../../utils/formatacao';
import AcoesTorneio from './AcoesTorneio';
import ModalEditarTorneio from './ModalEditarTorneio';
import styles from './styles.module.css';
import { useMesasConfirmadas } from './useMesasConfirmadas';
import { useTorneioLoja } from './useTorneioLoja';

type Modal = 'editar' | 'inscrever' | 'gerenciar' | null;

const ROTULO_STATUS = {
  Aberto: 'aberto',
  'Em Andamento': 'em andamento',
  Finalizado: 'finalizado',
  Cancelado: 'cancelado',
} as const;

/**
 * Situação exibida no card da mesa. "Revisar dados" = jogador reportou e a loja ainda não confirmou.
 */
function situacaoDaMesa(mesa: IMesaRodada, rodada: IRodada, confirmadas: Set<number>): SituacaoMesa {
  if (rodada.status === 'Finalizada' || confirmadas.has(mesa.id)) return 'Finalizado';
  if (mesa.time_vencedor === null) return 'Em andamento';
  return 'Revisar dados';
}

const InformacaoTorneioLoja = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const torneioId = Number(id);

  const {
    torneio,
    setTorneio,
    inscritos,
    rodadas,
    rodadaSelecionada,
    mesas,
    sobressalentes,
    carregando,
    carregandoMesas,
    erro,
    recarregar,
    selecionarRodada,
    recarregarMesas,
    recarregarInscritos,
  } = useTorneioLoja(torneioId);
  const { confirmadas, confirmar: marcarConfirmada } = useMesasConfirmadas(torneioId);

  const [modal, setModal] = useState<Modal>(null);
  const [resultadoFinal, setResultadoFinal] = useState(
    () => new URLSearchParams(window.location.search).get('preselect') === 'result',
  );
  const [seletorAberto, setSeletorAberto] = useState(false);

  // Fecha o seletor de rodadas ao clicar fora dele
  useEffect(() => {
    if (!seletorAberto) return;
    const fechar = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`.${styles.rodadaDropdownContainer}`)) setSeletorAberto(false);
    };
    document.addEventListener('click', fechar);
    return () => document.removeEventListener('click', fechar);
  }, [seletorAberto]);

  if (carregando) return <div className={styles.loading}>Carregando...</div>;
  if (!torneio) return <div className={styles.error}>{erro ?? 'Nenhum torneio encontrado.'}</div>;

  const escolherRodada = (rodada: IRodada) => {
    setResultadoFinal(false);
    setSeletorAberto(false);
    selecionarRodada(rodada);
  };

  const confirmarResultado = async (mesaId: number, pontuacaoTime1: number, pontuacaoTime2: number) => {
    await editarResultadoMesa(mesaId, pontuacaoTime1, pontuacaoTime2);
    marcarConfirmada(mesaId);
    await recarregarMesas();
  };

  const removerInscrito = async (inscricao: IInscricao) => {
    const confirmou = await confirmar({
      titulo: `Remover ${inscricao.username}?`,
      texto: 'O jogador sai do torneio e poderá se inscrever novamente se desejar.',
      icone: 'warning',
      confirmar: 'Remover',
      corConfirmar: CORES.perigo,
    });
    if (!confirmou) return;
    try {
      await retirarInscricao(inscricao.id, torneio.status);
      await recarregar();
    } catch (e) {
      alertarErro('Não foi possível remover o jogador', e);
    }
  };

  const jogadoresDisponiveis = inscritos.map((i) => ({ id: i.id_usuario, username: i.username }));

  const renderizarInscritos = () => (
    <div className={styles.mesasCard}>
      <h2 className={styles.cardTitulo}>Usuários inscritos</h2>
      <span className={styles.infoJogadores}>
        {inscritos.length} {inscritos.length === 1 ? 'jogador' : 'jogadores'}
      </span>
      {inscritos.length ? (
        <ul className={styles.playerList}>
          {inscritos.map((inscricao, indice) => (
            <li key={inscricao.id} className={styles.playerItem}>
              <div className={styles.playerInfoLeft}>
                <span className={styles.numeroJogador}>{indice + 1}.</span>
                <span className={styles.nomeJogador}>{inscricao.username}</span>
              </div>
              <button
                className={styles.removePlayerBtn}
                onClick={() => removerInscrito(inscricao)}
                title="Remover jogador"
              >
                <FiTrash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.mensagemVazia}>Nenhum jogador inscrito ainda.</div>
      )}
    </div>
  );

  const renderizarMesas = () => (
    <>
      <div className={styles.mesasCard}>
        <h2 className={styles.cardTitulo}>Mesas participantes</h2>
        {erro && <div className={styles.mensagemErro}>{erro}</div>}
        {carregandoMesas ? (
          <div className={styles.loading}>Carregando mesas...</div>
        ) : (
          <div className={styles.mesasGrid}>
            {rodadaSelecionada && mesas.length ? (
              mesas.map((mesa) => (
                <MesaCard
                  key={mesa.id}
                  mesaId={mesa.id}
                  numeroMesa={mesa.numero_mesa}
                  situacao={situacaoDaMesa(mesa, rodadaSelecionada, confirmadas)}
                  pontuacaoTime1={mesa.pontuacao_time_1}
                  pontuacaoTime2={mesa.pontuacao_time_2}
                  jogadoresDaMesa={mesa.jogadores}
                  jogadoresDisponiveis={jogadoresDisponiveis}
                  statusRodada={rodadaSelecionada.status}
                  podeInformarResultado={torneio.status === 'Em Andamento'}
                  onConfirmarResultado={confirmarResultado}
                  onRecarregarMesas={recarregarMesas}
                />
              ))
            ) : (
              <p className={styles.mensagemVazia}>Nenhuma mesa criada ainda.</p>
            )}
          </div>
        )}
      </div>

      <div className={styles.sobressalentesCard}>
        <h2 className={styles.cardTitulo}>Participantes sobressalentes</h2>
        <div className={styles.sobressalentesList}>
          {sobressalentes.length ? (
            sobressalentes.map((participante) => (
              <div key={participante.id} className={styles.sobressalenteItem}>
                {participante.username}
              </div>
            ))
          ) : (
            <p className={styles.mensagemVazia}>Nenhum participante sobressalente.</p>
          )}
        </div>
      </div>
    </>
  );

  const renderizarSeletorRodada = () => (
    <div className={styles.rodadaDropdownContainer}>
      <button className={styles.rodadaDropdownButton} onClick={() => setSeletorAberto(!seletorAberto)}>
        <span>
          {resultadoFinal
            ? 'Resultado final'
            : rodadaSelecionada
              ? `Rodada ${rodadaSelecionada.numero_rodada} de ${rodadas.length}`
              : 'Selecione uma rodada'}
        </span>
        <FiChevronDown className={seletorAberto ? styles.iconRotate : ''} />
      </button>

      {seletorAberto && (
        <div className={styles.rodadaDropdownMenu}>
          {rodadas.map((rodada) => (
            <div
              key={rodada.id}
              className={`${styles.rodadaDropdownItem} ${
                rodadaSelecionada?.id === rodada.id && !resultadoFinal ? styles.rodadaAtiva : ''
              }`}
              onClick={() => escolherRodada(rodada)}
            >
              <span>Rodada {rodada.numero_rodada}</span>
              <span className={styles.rodadaStatus}>{rodada.status}</span>
            </div>
          ))}
          {torneio.status === 'Finalizado' && (
            <div
              className={`${styles.rodadaDropdownItem} ${resultadoFinal ? styles.rodadaAtiva : ''}`}
              onClick={() => {
                setResultadoFinal(true);
                setSeletorAberto(false);
              }}
            >
              <span>🏆 Resultado final</span>
              <span className={styles.rodadaStatus}>Final</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderizarColunaEsquerda = () => {
    if (torneio.status === 'Aberto') return renderizarInscritos();
    if (resultadoFinal) {
      return (
        <CardRanking
          tournamentId={torneio.id}
          isRankingFinal
          titulo="🏆 Ranking Final do Torneio"
          subtitulo="Classificação final com todas as métricas"
          mostrarMetricasAvancadas
        />
      );
    }
    return renderizarMesas();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Torneio {ROTULO_STATUS[torneio.status]}</h1>
          <p className={styles.subtitulo}>{torneio.nome}</p>
        </div>

        <div className={styles.headerActions}>
          <AcoesTorneio
            torneio={torneio}
            rodadaSelecionada={rodadaSelecionada}
            onAtualizar={recarregar}
            onVoltar={() => navigate('/historico')}
            onEditar={() => setModal('editar')}
            onInscreverJogador={() => setModal('inscrever')}
            onGerenciarInscricoes={() => setModal('gerenciar')}
          />
          {torneio.status !== 'Aberto' && rodadas.length > 0 && renderizarSeletorRodada()}
        </div>
      </div>

      <div className={styles.gridContainer}>
        <div className={styles.colunaEsquerda}>{renderizarColunaEsquerda()}</div>

        <div className={styles.colunaDireita}>
          <CardInfoTorneio
            title="Informações do Torneio"
            name={torneio.nome}
            date={formatarData(torneio.data_inicio)}
            time={formatarHora(torneio.data_inicio)}
            location={torneio.loja_nome}
            price={formatarPreco(torneio.inscricao_gratuita, torneio.valor_inscricao)}
            players={inscritos.length}
          />
          <RegrasPartida regras={torneio.regras} />
          {torneio.status !== 'Aberto' && rodadaSelecionada && !resultadoFinal && (
            <CardRanking
              tournamentId={torneio.id}
              rodadaId={rodadaSelecionada.id}
              titulo={`🏆 Ranking - Rodada ${rodadaSelecionada.numero_rodada}`}
              subtitulo="Pontuação acumulada com métricas avançadas"
              mostrarMetricasAvancadas
            />
          )}
        </div>
      </div>

      {modal === 'editar' && (
        <ModalEditarTorneio
          torneio={torneio}
          onFechar={() => setModal(null)}
          onSalvo={(atualizado) => {
            setTorneio(atualizado);
            setModal(null);
          }}
        />
      )}
      {modal === 'inscrever' && (
        <ModalInscricaoJogador
          torneioId={torneio.id}
          torneioNome={torneio.nome}
          onClose={() => setModal(null)}
          onSuccess={() => recarregar()}
        />
      )}
      {modal === 'gerenciar' && (
        <ModalGerenciarInscricoes
          torneioId={torneio.id}
          torneioStatus={torneio.status}
          onClose={() => setModal(null)}
          onAlterado={() => recarregarInscritos()}
        />
      )}
    </div>
  );
};

export default InformacaoTorneioLoja;
