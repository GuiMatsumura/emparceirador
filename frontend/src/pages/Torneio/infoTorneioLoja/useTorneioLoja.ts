import { useCallback, useEffect, useRef, useState } from 'react';

import { listarInscricoesAtivas } from '../../../services/inscricaoServico';
import { buscarMesasDaRodada, buscarRodadasDoTorneio, buscarSobressalentes } from '../../../services/rodadaServico';
import { buscarTorneioPorId } from '../../../services/torneioServico';
import type { IInscricao, IMesaRodada, IParticipante, IRodada, ITorneio } from '../../../tipos/tipos';
import { mensagemDeErro } from '../../../utils/erros';

/** Rodada exibida por padrão: a em andamento, senão a mais recente. */
function rodadaPadrao(rodadas: IRodada[]): IRodada | null {
  return rodadas.find((r) => r.status === 'Em Andamento') ?? rodadas.at(-1) ?? null;
}

/**
 * Dados da tela de gestão do torneio (loja): torneio, inscritos, rodadas e mesas da rodada selecionada.
 */
export function useTorneioLoja(torneioId: number) {
  const [torneio, setTorneio] = useState<ITorneio | null>(null);
  const [inscritos, setInscritos] = useState<IInscricao[]>([]);
  const [rodadas, setRodadas] = useState<IRodada[]>([]);
  const [rodadaSelecionada, setRodadaSelecionada] = useState<IRodada | null>(null);
  const [mesas, setMesas] = useState<IMesaRodada[]>([]);
  const [sobressalentes, setSobressalentes] = useState<IParticipante[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMesas, setCarregandoMesas] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Id da rodada escolhida, para mantê-la selecionada ao recarregar os dados
  const idRodadaSelecionada = useRef<number | null>(null);

  const carregarMesas = useCallback(async (rodada: IRodada | null) => {
    if (!rodada) {
      setMesas([]);
      setSobressalentes([]);
      return;
    }
    setCarregandoMesas(true);
    try {
      const [dadosMesas, dadosSobressalentes] = await Promise.all([
        buscarMesasDaRodada(rodada.id),
        buscarSobressalentes(rodada.id),
      ]);
      setMesas(dadosMesas);
      setSobressalentes(dadosSobressalentes);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregandoMesas(false);
    }
  }, []);

  /**
   * Recarrega tudo. Mantém a rodada selecionada (com dados atualizados) quando ela ainda existe;
   * `selecionar` força outra seleção ('ultima' = a mais recente, útil após criar uma rodada).
   */
  const recarregar = useCallback(
    async (selecionar?: 'ultima') => {
      setErro(null);
      try {
        const [dadosTorneio, dadosInscritos, dadosRodadas] = await Promise.all([
          buscarTorneioPorId(torneioId),
          listarInscricoesAtivas(torneioId),
          buscarRodadasDoTorneio(torneioId),
        ]);
        setTorneio(dadosTorneio);
        setInscritos(dadosInscritos);
        setRodadas(dadosRodadas);

        const rodada =
          selecionar === 'ultima'
            ? (dadosRodadas.at(-1) ?? null)
            : (dadosRodadas.find((r) => r.id === idRodadaSelecionada.current) ?? rodadaPadrao(dadosRodadas));
        idRodadaSelecionada.current = rodada?.id ?? null;
        setRodadaSelecionada(rodada);
        await carregarMesas(rodada);
      } catch (e) {
        setErro(mensagemDeErro(e));
      } finally {
        setCarregando(false);
      }
    },
    [torneioId, carregarMesas],
  );

  useEffect(() => {
    setCarregando(true);
    recarregar();
  }, [recarregar]);

  const selecionarRodada = useCallback(
    (rodada: IRodada) => {
      idRodadaSelecionada.current = rodada.id;
      setRodadaSelecionada(rodada);
      carregarMesas(rodada);
    },
    [carregarMesas],
  );

  const recarregarInscritos = useCallback(async () => {
    setInscritos(await listarInscricoesAtivas(torneioId));
  }, [torneioId]);

  return {
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
    recarregarMesas: () => carregarMesas(rodadaSelecionada),
    recarregarInscritos,
  };
}
