import { useState, type ChangeEvent } from 'react';

import Button from '../../../components/Button';
import { atualizarTorneio } from '../../../services/torneioServico';
import type { ITorneio, ITorneioEntrada } from '../../../tipos/tipos';
import { alertarAviso, alertarErro, confirmar } from '../../../utils/alertas';
import {
  formatarMoeda,
  inputLocalParaIso,
  isoParaInputLocal,
  mascararMoeda,
  moedaParaNumero,
} from '../../../utils/formatacao';
import estilos from './modalEditarStyles.module.css';

interface ModalEditarTorneioProps {
  torneio: ITorneio;
  onFechar: () => void;
  onSalvo: (torneio: ITorneio) => void;
}

/** Valores do formulário (tudo como texto, como vem dos inputs). */
function formularioInicial(torneio: ITorneio) {
  return {
    nome: torneio.nome,
    descricao: torneio.descricao,
    dataHora: isoParaInputLocal(torneio.data_inicio),
    regras: torneio.regras,
    gratuito: torneio.inscricao_gratuita,
    valor: formatarMoeda(Number(torneio.valor_inscricao ?? 0)),
    vagasLimitadas: torneio.vagas_limitadas,
    capacidade: torneio.qnt_vagas ? String(torneio.qnt_vagas) : '',
    vitoria: String(torneio.pontuacao_vitoria),
    derrota: String(torneio.pontuacao_derrota),
    empate: String(torneio.pontuacao_empate),
    bye: String(torneio.pontuacao_bye),
    rodadas: torneio.quantidade_rodadas ? String(torneio.quantidade_rodadas) : '',
  };
}

type Formulario = ReturnType<typeof formularioInicial>;

const CAMPOS_PONTUACAO: { campo: keyof Formulario; rotulo: string }[] = [
  { campo: 'vitoria', rotulo: 'Vitória' },
  { campo: 'derrota', rotulo: 'Derrota' },
  { campo: 'empate', rotulo: 'Empate' },
  { campo: 'bye', rotulo: 'Bye' },
];

const ModalEditarTorneio = ({ torneio, onFechar, onSalvo }: ModalEditarTorneioProps) => {
  const [form, setForm] = useState<Formulario>(() => formularioInicial(torneio));
  const [salvando, setSalvando] = useState(false);

  const alterar =
    (campo: keyof Formulario) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((atual) => ({ ...atual, [campo]: e.target.value }));

  const montarDados = (): ITorneioEntrada => ({
    nome: form.nome.trim(),
    descricao: form.descricao.trim(),
    regras: form.regras.trim(),
    banner: torneio.banner,
    data_inicio: inputLocalParaIso(form.dataHora),
    inscricao_gratuita: form.gratuito,
    valor_inscricao: form.gratuito ? null : moedaParaNumero(form.valor),
    vagas_limitadas: form.vagasLimitadas,
    qnt_vagas: form.vagasLimitadas ? parseInt(form.capacidade, 10) || null : null,
    pontuacao_vitoria: parseInt(form.vitoria, 10) || 0,
    pontuacao_derrota: parseInt(form.derrota, 10) || 0,
    pontuacao_empate: parseInt(form.empate, 10) || 0,
    pontuacao_bye: parseInt(form.bye, 10) || 0,
    quantidade_rodadas: parseInt(form.rodadas, 10) || null,
  });

  const salvar = async () => {
    if (!form.nome.trim() || !form.regras.trim() || !form.dataHora) {
      alertarAviso('Atenção', 'Preencha os campos obrigatórios: Nome, Regras e Data/Hora.');
      return;
    }
    if (form.vagasLimitadas && !form.capacidade) {
      alertarAviso('Atenção', 'Informe a capacidade máxima de jogadores.');
      return;
    }
    if (!(await confirmar({ titulo: 'Salvar alterações?', confirmar: 'Salvar' }))) return;

    setSalvando(true);
    try {
      onSalvo(await atualizarTorneio(torneio.id, montarDados()));
    } catch (erro) {
      alertarErro('Erro ao salvar', erro);
    } finally {
      setSalvando(false);
    }
  };

  const opcaoRadio = (id: string, rotulo: string, marcado: boolean, aoMarcar: () => void) => (
    <>
      <input type="radio" id={id} checked={marcado} onChange={aoMarcar} className={estilos.radioInput} />
      <label htmlFor={id} className={estilos.radioLabel}>
        {rotulo}
      </label>
    </>
  );

  return (
    <div className={estilos.overlayModal} onClick={onFechar}>
      <div className={estilos.modalConteudo} onClick={(e) => e.stopPropagation()}>
        <div className={estilos.modalHeader}>
          <h2 className={estilos.modalTitulo}>Editar Torneio</h2>
          <button onClick={onFechar} className={estilos.modalCloseButton} aria-label="Fechar">
            ×
          </button>
        </div>

        {salvando ? (
          <div className={estilos.loadingContainer}>
            <div>Salvando alterações...</div>
          </div>
        ) : (
          <div className={estilos.modalBody}>
            <div className={estilos.secao}>
              <h3 className={estilos.tituloSessao}>ℹ️ Informações Básicas</h3>
              <div className={estilos.grupoInputs}>
                <div className={estilos.inputGroup}>
                  <label className={estilos.inputLabel}>Nome do Torneio *</label>
                  <input type="text" value={form.nome} onChange={alterar('nome')} className={estilos.input} />
                </div>
                <div className={estilos.inputComIcone}>
                  <label className={estilos.inputLabel}>Data e Hora *</label>
                  <input
                    type="datetime-local"
                    value={form.dataHora}
                    onChange={alterar('dataHora')}
                    className={estilos.inputDatetime}
                  />
                </div>
              </div>
              <div className={estilos.textareaContainer}>
                <label className={estilos.inputLabel}>Descrição (opcional)</label>
                <textarea
                  value={form.descricao}
                  onChange={alterar('descricao')}
                  className={estilos.textarea}
                  placeholder="Breve descrição do torneio..."
                  rows={4}
                />
              </div>
            </div>

            <div className={estilos.secao}>
              <h3 className={estilos.tituloSessao}>📋 Regras da Partida *</h3>
              <textarea value={form.regras} onChange={alterar('regras')} className={estilos.textarea} rows={6} />
            </div>

            <div className={estilos.secao}>
              <h3 className={estilos.tituloSessao}>💰 Inscrição</h3>
              <div className={estilos.grupoRadio}>
                <label className={estilos.inputLabel}>Modalidade de Inscrição *</label>
                <div className={estilos.radioGroup}>
                  {opcaoRadio('gratuito-edit', 'Gratuito', form.gratuito, () =>
                    setForm((atual) => ({ ...atual, gratuito: true })),
                  )}
                  {opcaoRadio('pago-edit', 'Pago', !form.gratuito, () =>
                    setForm((atual) => ({ ...atual, gratuito: false })),
                  )}
                </div>
              </div>
              {!form.gratuito && (
                <div className={estilos.inputLimitado}>
                  <label className={estilos.inputLabel}>Valor da Inscrição</label>
                  <input
                    type="text"
                    value={form.valor}
                    onChange={(e) => setForm((atual) => ({ ...atual, valor: mascararMoeda(e.target.value) }))}
                    className={estilos.input}
                  />
                </div>
              )}
            </div>

            <div className={estilos.secao}>
              <h3 className={estilos.tituloSessao}>👥 Limite de Vagas</h3>
              <div className={estilos.grupoRadio}>
                <label className={estilos.inputLabel}>Tipo de Vagas *</label>
                <div className={estilos.radioGroup}>
                  {opcaoRadio('ilimitadas-edit', 'Vagas ilimitadas', !form.vagasLimitadas, () =>
                    setForm((atual) => ({ ...atual, vagasLimitadas: false, capacidade: '' })),
                  )}
                  {opcaoRadio('limitadas-edit', 'Vagas limitadas', form.vagasLimitadas, () =>
                    setForm((atual) => ({ ...atual, vagasLimitadas: true })),
                  )}
                </div>
              </div>
              {form.vagasLimitadas && (
                <div className={estilos.inputLimitado}>
                  <label className={estilos.inputLabel}>Capacidade Máxima *</label>
                  <input
                    type="number"
                    min="1"
                    value={form.capacidade}
                    onChange={alterar('capacidade')}
                    className={estilos.input}
                    placeholder="32"
                  />
                </div>
              )}
            </div>

            <div className={estilos.secao}>
              <h3 className={estilos.tituloSessao}>🎯 Sistema de Pontuação</h3>
              <div className={estilos.grupoInputs}>
                {CAMPOS_PONTUACAO.map(({ campo, rotulo }) => (
                  <div key={campo} className={estilos.inputGroup}>
                    <label className={estilos.inputLabel}>{rotulo}</label>
                    <input
                      type="number"
                      min="0"
                      value={form[campo] as string}
                      onChange={alterar(campo)}
                      className={estilos.input}
                    />
                  </div>
                ))}
              </div>
              <div className={estilos.inputGroup}>
                <label className={estilos.inputLabel}>Quantidade de Rodadas (vazio = sem limite)</label>
                <input
                  type="number"
                  min="1"
                  value={form.rodadas}
                  onChange={alterar('rodadas')}
                  className={estilos.input}
                />
              </div>
            </div>
          </div>
        )}

        <div className={estilos.modalFooter}>
          <Button label="Cancelar" onClick={onFechar} backgroundColor="#6c757d" width="auto" />
          <Button label={salvando ? 'Salvando...' : 'Salvar Alterações'} onClick={salvar} width="auto" disabled={salvando} />
        </div>
      </div>
    </div>
  );
};

export default ModalEditarTorneio;
