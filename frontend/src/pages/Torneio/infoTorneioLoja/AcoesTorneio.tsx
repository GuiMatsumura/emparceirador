import { useState } from 'react';

import Button from '../../../components/Button';
import { emparelharRodada, iniciarRodada } from '../../../services/rodadaServico';
import { avancarRodada, cancelarTorneio, finalizarTorneio, iniciarTorneio } from '../../../services/torneioServico';
import type { IRodada, ITorneio } from '../../../tipos/tipos';
import { alertarErro, alertarSucesso, avisoRapido, CORES, confirmar, escaparHtml } from '../../../utils/alertas';

interface AcoesTorneioProps {
  torneio: ITorneio;
  rodadaSelecionada: IRodada | null;
  /** Recarrega a tela após uma ação ('ultima' seleciona a rodada mais recente). */
  onAtualizar: (selecionar?: 'ultima') => Promise<void>;
  onVoltar: () => void;
  onEditar: () => void;
  onInscreverJogador: () => void;
  onGerenciarInscricoes: () => void;
}

interface Acao<T> {
  confirmacao: Parameters<typeof confirmar>[0];
  executar: () => Promise<T>;
  /** Mensagem de sucesso (HTML) a partir do retorno da API. */
  sucesso: (resultado: T) => { titulo: string; html?: string };
  tituloErro: string;
  selecionarUltimaRodada?: boolean;
}

const BOTAO = { width: 'auto', height: '44px', paddingHorizontal: '20px', fontSize: '14px' } as const;

/** Botões do cabeçalho da gestão do torneio, conforme o status do torneio e da rodada. */
const AcoesTorneio = ({
  torneio,
  rodadaSelecionada,
  onAtualizar,
  onVoltar,
  onEditar,
  onInscreverJogador,
  onGerenciarInscricoes,
}: AcoesTorneioProps) => {
  const [emExecucao, setEmExecucao] = useState(false);
  const nome = escaparHtml(torneio.nome);

  /** Confirma, executa, mostra o resultado e recarrega a tela. */
  async function executar<T>(acao: Acao<T>) {
    if (!(await confirmar(acao.confirmacao))) return;
    setEmExecucao(true);
    try {
      const resultado = await acao.executar();
      const { titulo, html } = acao.sucesso(resultado);
      await alertarSucesso(titulo, html);
      await onAtualizar(acao.selecionarUltimaRodada ? 'ultima' : undefined);
    } catch (erro) {
      alertarErro(acao.tituloErro, erro);
    } finally {
      setEmExecucao(false);
    }
  }

  const iniciar = () =>
    executar({
      confirmacao: {
        titulo: 'Iniciar torneio?',
        html: `<p>Inscritos: <strong>${torneio.qnt_inscritos}</strong></p><p>A primeira rodada será criada e os jogadores emparelhados.</p>`,
        confirmar: 'Sim, iniciar',
        corConfirmar: CORES.destaque,
      },
      executar: () => iniciarTorneio(torneio.id),
      sucesso: (r) => ({
        titulo: 'Torneio iniciado!',
        html: `<p>${escaparHtml(r.message)}</p>`,
      }),
      tituloErro: 'Não foi possível iniciar o torneio',
      selecionarUltimaRodada: true,
    });

  const cancelar = () =>
    executar({
      confirmacao: {
        titulo: 'Cancelar torneio?',
        html: `<p>O torneio <strong>"${nome}"</strong> será cancelado e não poderá mais ser iniciado.</p><p>Inscrições e dados são mantidos para histórico.</p>`,
        icone: 'warning',
        confirmar: 'Sim, cancelar',
        cancelar: 'Voltar',
        corConfirmar: CORES.perigo,
      },
      executar: () => cancelarTorneio(torneio.id),
      sucesso: () => ({ titulo: 'Torneio cancelado' }),
      tituloErro: 'Não foi possível cancelar o torneio',
    });

  const avancar = () =>
    executar({
      confirmacao: {
        titulo: 'Avançar para a próxima rodada?',
        texto: 'A rodada atual será encerrada e a próxima será criada já emparelhada.',
        confirmar: 'Sim, avançar',
      },
      executar: () => avancarRodada(torneio.id),
      sucesso: (r) => ({
        titulo: 'Rodada avançada!',
        html: `<p>${escaparHtml(r.message)}</p><p>Revise as mesas e clique em "Iniciar Rodada".</p>`,
      }),
      tituloErro: 'Não foi possível avançar a rodada',
      selecionarUltimaRodada: true,
    });

  const reemparelhar = (rodada: IRodada) =>
    executar({
      confirmacao: {
        titulo: 'Refazer o emparelhamento?',
        html: '<p>As mesas atuais serão descartadas e um novo emparelhamento Swiss será gerado.</p><p>Útil quando jogadores entram ou saem do torneio.</p>',
        confirmar: 'Re-emparelhar',
        corConfirmar: CORES.alerta,
      },
      executar: () => emparelharRodada(rodada.id, 'swiss'),
      sucesso: (r) => ({
        titulo: 'Emparelhamento refeito!',
        html: `<p>Mesas criadas: <strong>${r.mesas_criadas}</strong></p><p>Jogadores: <strong>${r.total_jogadores}</strong></p>`,
      }),
      tituloErro: 'Não foi possível refazer o emparelhamento',
    });

  const comecarRodada = (rodada: IRodada) =>
    executar({
      confirmacao: {
        titulo: `Iniciar a rodada ${rodada.numero_rodada}?`,
        texto: 'Os jogadores poderão reportar os resultados das mesas.',
        confirmar: 'Iniciar',
        corConfirmar: CORES.destaque,
      },
      executar: () => iniciarRodada(rodada.id),
      sucesso: () => ({ titulo: 'Rodada iniciada!' }),
      tituloErro: 'Não foi possível iniciar a rodada',
    });

  const finalizar = () =>
    executar({
      confirmacao: {
        titulo: 'Finalizar torneio?',
        html: `<p>O torneio <strong>"${nome}"</strong> será encerrado e o ranking final será gerado.</p><p><strong>Esta ação é irreversível.</strong></p>`,
        icone: 'warning',
        confirmar: 'Sim, finalizar',
        corConfirmar: CORES.perigo,
      },
      executar: () => finalizarTorneio(torneio.id),
      sucesso: (r) => ({
        titulo: 'Torneio finalizado!',
        html:
          `<p>Total de rodadas: <strong>${r.total_rodadas}</strong></p><ol style="text-align:left">` +
          r.ranking
            .slice(0, 10)
            .map((j) => `<li>${escaparHtml(j.jogador_nome)} — <strong>${j.pontos}</strong> pts</li>`)
            .join('') +
          '</ol>',
      }),
      tituloErro: 'Não foi possível finalizar o torneio',
    });

  const compartilhar = async () => {
    const url = `${window.location.origin}/inscricao-torneio/${torneio.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: torneio.nome, text: `Participe do torneio ${torneio.nome}!`, url });
        return;
      }
    } catch {
      // Compartilhamento cancelado ou indisponível: copia o link
    }
    await navigator.clipboard.writeText(url);
    avisoRapido('Link de inscrição copiado!');
  };

  const botao = (label: string, onClick: () => void, cor?: string) => (
    <Button key={label} label={label} onClick={onClick} disabled={emExecucao} backgroundColor={cor} {...BOTAO} />
  );

  const botoes = [botao('Voltar', onVoltar)];

  if (torneio.status === 'Aberto') {
    botoes.push(
      botao('Inscrever Jogador', onInscreverJogador, CORES.sucesso),
      botao('Editar', onEditar, CORES.neutro),
      botao('Compartilhar', compartilhar, CORES.destaque),
      botao('Cancelar Torneio', cancelar, '#dc3545'),
      botao('Iniciar Torneio', iniciar),
    );
  }

  if (torneio.status === 'Em Andamento') {
    if (rodadaSelecionada?.status === 'Em Andamento') {
      botoes.push(botao('Avançar Rodada', avancar, CORES.sucesso));
    }
    if (rodadaSelecionada?.status === 'Emparelhamento') {
      botoes.push(
        botao('Re-emparelhar', () => reemparelhar(rodadaSelecionada), CORES.alerta),
        botao('Iniciar Rodada', () => comecarRodada(rodadaSelecionada), CORES.sucesso),
      );
    }
    botoes.push(
      botao('Finalizar Torneio', finalizar, CORES.perigo),
      botao('Inscrever Jogador', onInscreverJogador, CORES.sucesso),
      botao('Gerenciar Inscrições', onGerenciarInscricoes, '#17a2b8'),
    );
  }

  return <>{botoes}</>;
};

export default AcoesTorneio;
