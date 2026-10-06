import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import Button from '../../../components/Button';
import CardInfoTorneio from '../../../components/CardInfoTorneio';
import CardRanking from '../../../components/CardRanking';
import RegrasPartida from '../../../components/CardRegrasPartida';
import DropdownRodadas from '../../../components/DropdownRodadas';
import { useIntervalo } from '../../../hooks/useIntervalo';
import { buscarMinhaMesaNaRodada } from '../../../services/mesaServico';
import { buscarTorneioPorId } from '../../../services/torneioServico';
import type { IMesaAtiva, IRodada, ITorneio } from '../../../tipos/tipos';
import { avisoRapido, confirmar } from '../../../utils/alertas';
import { mensagemDeErro } from '../../../utils/erros';
import { formatarData, formatarHora, formatarPreco } from '../../../utils/formatacao';
import MesaAtivaComponent from '../mesa-ativa';
import styles from '../styles.module.css';

const INTERVALO_ATUALIZACAO_MS = 30_000;

/** Assinatura do estado da mesa: muda quando a rodada avança ou o resultado é registrado. */
const assinatura = (mesa: IMesaAtiva | null) => (mesa ? `${mesa.status_rodada}-${mesa.time_vencedor}` : 'bye');

/** Visão do jogador de um torneio iniciado: situação da rodada, resultado e ranking. */
export default function Intervalo() {
  const { id } = useParams<{ id: string }>();
  const [torneio, setTorneio] = useState<ITorneio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [rodadaSelecionada, setRodadaSelecionada] = useState<IRodada | null>(null);
  const [resultadoFinalSelecionado, setResultadoFinalSelecionado] = useState(false);
  const [minhaMesa, setMinhaMesa] = useState<IMesaAtiva | null>(null);
  const [carregandoMesa, setCarregandoMesa] = useState(false);
  const [mesaAtivaAberta, setMesaAtivaAberta] = useState(false);
  const ultimaAssinatura = useRef<string | null>(null);

  useEffect(() => {
    buscarTorneioPorId(Number(id))
      .then(setTorneio)
      .catch((e) => setErro(mensagemDeErro(e)))
      .finally(() => setCarregando(false));
  }, [id]);

  /** Recarrega a mesa do jogador na rodada selecionada; avisa se algo mudou desde a última consulta. */
  const atualizarMesa = useCallback(
    async (avisarMudanca: boolean) => {
      if (!rodadaSelecionada) return;
      try {
        const mesa = await buscarMinhaMesaNaRodada(rodadaSelecionada.id);
        const nova = assinatura(mesa);
        if (avisarMudanca && ultimaAssinatura.current !== null && nova !== ultimaAssinatura.current) {
          avisoRapido(
            mesa?.status_rodada === 'Finalizada' ? 'Rodada finalizada pelo organizador' : 'Sua mesa foi atualizada',
          );
        }
        ultimaAssinatura.current = nova;
        setMinhaMesa(mesa);
      } catch {
        // Falha pontual no polling: mantém o que já está na tela.
      }
    },
    [rodadaSelecionada],
  );

  useEffect(() => {
    if (!rodadaSelecionada) {
      setMinhaMesa(null);
      return;
    }
    ultimaAssinatura.current = null;
    setCarregandoMesa(true);
    atualizarMesa(false).finally(() => setCarregandoMesa(false));
  }, [rodadaSelecionada, atualizarMesa]);

  useIntervalo(() => atualizarMesa(true), INTERVALO_ATUALIZACAO_MS, Boolean(rodadaSelecionada) && !mesaAtivaAberta);

  const selecionarRodada = async (rodada: IRodada) => {
    setResultadoFinalSelecionado(false);
    setRodadaSelecionada(rodada);
    if (rodada.status === 'Em Andamento') {
      const irParaMesa = await confirmar({
        titulo: 'Ir para a mesa?',
        texto: 'Esta rodada está em andamento. Deseja abrir a sua mesa?',
        confirmar: 'Sim, ir para a mesa',
        cancelar: 'Apenas ver resultados',
      });
      if (irParaMesa) setMesaAtivaAberta(true);
    }
  };

  const selecionarResultadoFinal = () => {
    setResultadoFinalSelecionado(true);
    setRodadaSelecionada(null);
  };

  const voltarDaMesa = () => {
    setMesaAtivaAberta(false);
    atualizarMesa(false);
  };

  if (mesaAtivaAberta && rodadaSelecionada && torneio) {
    return (
      <MesaAtivaComponent
        rodadaId={rodadaSelecionada.id}
        torneioId={torneio.id}
        onMesaFinalizada={voltarDaMesa}
        onVoltarParaIntervalo={voltarDaMesa}
      />
    );
  }

  if (carregando) return <p>Carregando...</p>;
  if (erro || !torneio) return <p>{erro ?? 'Torneio não encontrado.'}</p>;

  const renderizarSituacao = () => {
    if (resultadoFinalSelecionado) {
      return <CardRanking tournamentId={torneio.id} isRankingFinal titulo="🏆 Ranking Final do Torneio" mostrarMetricasAvancadas />;
    }
    if (!rodadaSelecionada || carregandoMesa) {
      return (
        <div className={styles.intervaloCard}>
          <h2 className={styles.intervaloTitulo}>Carregando...</h2>
          <p className={styles.intervaloTexto}>Buscando informações da rodada...</p>
        </div>
      );
    }
    if (!minhaMesa) {
      return (
        <div className={styles.intervaloCard}>
          <h2 className={styles.intervaloTitulo}>Você recebeu um bye nesta rodada.</h2>
          <p className={styles.intervaloTexto}>Aproveite para tomar uma água enquanto aguarda a próxima rodada.</p>
        </div>
      );
    }
    if (minhaMesa.status_rodada === 'Emparelhamento') {
      return (
        <div className={styles.intervaloCard}>
          <h2 className={styles.intervaloTitulo}>Emparelhamento</h2>
          <p className={styles.intervaloTexto}>
            A loja está emparelhando os jogadores, aproveite para tomar uma água enquanto aguarda a próxima rodada.
          </p>
        </div>
      );
    }
    if (minhaMesa.status_rodada === 'Em Andamento') {
      return (
        <div className={styles.intervaloCard}>
          <h2 className={styles.intervaloTitulo}>Rodada {minhaMesa.numero_rodada} em andamento</h2>
          <p className={styles.intervaloTexto}>Você está na mesa {minhaMesa.numero_mesa}.</p>
          <Button label="Ir para a minha mesa" onClick={() => setMesaAtivaAberta(true)} />
        </div>
      );
    }

    const meuPlacar = minhaMesa.meu_time === 1 ? minhaMesa.pontuacao_time_1 : minhaMesa.pontuacao_time_2;
    const placarAdversario = minhaMesa.meu_time === 1 ? minhaMesa.pontuacao_time_2 : minhaMesa.pontuacao_time_1;
    const venceu = minhaMesa.time_vencedor === minhaMesa.meu_time;
    const perdeu = minhaMesa.time_vencedor !== null && minhaMesa.time_vencedor !== 0 && !venceu;
    return (
      <div className={styles.intervaloCard}>
        <h2 className={styles.intervaloTitulo}>Resultado da Rodada {minhaMesa.numero_rodada}</h2>
        <p className={styles.intervaloTexto}>A rodada foi finalizada.</p>

        <div className={styles.resultadoIntervalo}>
          <h3 className={styles.resultadoTitulo}>Resultado da Partida</h3>
          <div className={styles.duplaResultado}>
            <div className={styles.duplaResultadoHeader}>
              <span className={styles.pontuacaoResultado}>Meu time: {meuPlacar}</span>
              {venceu && <span className={styles.vencedorTag}>Vencedor</span>}
            </div>
          </div>
          <div className={styles.vsResultado}>VS</div>
          <div className={styles.duplaResultado}>
            <div className={styles.duplaResultadoHeader}>
              <span className={styles.pontuacaoResultado}>Time adversário: {placarAdversario}</span>
              {perdeu && <span className={styles.vencedorTag}>Vencedor</span>}
            </div>
          </div>
          {minhaMesa.time_vencedor === 0 && <div className={styles.empateTag}>Partida Empatada</div>}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>{resultadoFinalSelecionado ? 'Resultado Final' : 'Intervalo'}</h1>
          <p className={styles.subtitulo}>{torneio.nome}</p>
        </div>
        <div className={styles.rodadaBadge}>
          <DropdownRodadas
            tournamentId={torneio.id}
            rodadaSelecionada={rodadaSelecionada}
            onSelecionarRodada={selecionarRodada}
            onSelecionarResultadoFinal={selecionarResultadoFinal}
            resultadoFinalSelecionado={resultadoFinalSelecionado}
            tournamentStatus={torneio.status}
          />
        </div>
      </div>

      <div className={styles.gridContainer}>
        <div className={styles.colunaEsquerda}>{renderizarSituacao()}</div>

        <div className={styles.colunaDireita}>
          <CardInfoTorneio
            title="Informações do Torneio"
            name={torneio.nome}
            date={formatarData(torneio.data_inicio)}
            time={formatarHora(torneio.data_inicio)}
            location={torneio.loja_nome}
            price={formatarPreco(torneio.inscricao_gratuita, torneio.valor_inscricao)}
            players={torneio.qnt_inscritos}
          />

          <RegrasPartida regras={torneio.regras} />

          {rodadaSelecionada && !resultadoFinalSelecionado && (
            <CardRanking
              tournamentId={torneio.id}
              rodadaId={rodadaSelecionada.id}
              titulo={`🏆 Ranking - Rodada ${rodadaSelecionada.numero_rodada}`}
              limite={10}
              mostrarMetricasAvancadas
            />
          )}
        </div>
      </div>
    </div>
  );
}
