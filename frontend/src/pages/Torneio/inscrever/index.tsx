import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import estilos from "./styles.module.css";

import Input from "../../../components/Input";
import Button from "../../../components/Button";
import { useSessao } from "../../../contextos/AuthContexto";
import { inscreverNoTorneio } from "../../../services/inscricaoServico";
import { buscarTorneioPorId } from "../../../services/torneioServico";
import type { ITorneio } from "../../../tipos/tipos";
import { alertarAviso, alertarErro, alertarSucesso, escaparHtml } from "../../../utils/alertas";
import { mensagemDeErro } from "../../../utils/erros";
import { formatarData, formatarHora, formatarPreco } from "../../../utils/formatacao";
import { FaCalendarAlt, FaClock, FaStore, FaMoneyBillAlt } from "react-icons/fa";
import { MdOutlinePeople } from "react-icons/md";

const InscricaoTorneio: React.FC = () => {
  // hook para acessar dados do usuário logado
  const { usuario } = useSessao();
  
  // hook para navegação
  const navigate = useNavigate();
  
  // estados locais para capturar os campos do formulário
  const [deck, setDeck] = useState("");
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const corLabelInputs = "#FFFFFF";

  // estados para dados do torneio
  const [torneio, setTorneio] = useState<ITorneio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // pegar o ID do torneio da URL
  const { id } = useParams<{ id: string }>();

  // buscar dados do torneio quando o componente carregar
  useEffect(() => {
    const carregarTorneio = async () => {
      if (!id) {
        setErro("ID do torneio não fornecido");
        setCarregando(false);
        return;
      }

      try {
        setCarregando(true);
        const dadosTorneio = await buscarTorneioPorId(parseInt(id));
        setTorneio(dadosTorneio);
        setErro(null);
      } catch (error) {
        setErro(mensagemDeErro(error));
      } finally {
        setCarregando(false);
      }
    };

    carregarTorneio();
  }, [id]);

  // scroll para o topo quando o componente carregar
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const formatarRegras = (regras: string | null | undefined) => {
    if (!regras) return [];
    return regras.split('\n').filter(regra => regra.trim() !== '');
  };

  // função de envio do formulário
  const enviarFormulario = async () => {
    if (!aceiteTermos) {
      alertarAviso('Atenção', 'É necessário aceitar os termos e condições do torneio.');
      return;
    }

    if (!torneio || !id) {
      alertarAviso('Erro', 'Torneio não encontrado.');
      return;
    }

    if (!usuario) {
      alertarAviso('Erro', 'Usuário não está logado.');
      return;
    }

    try {
      setEnviando(true);
      
      await inscreverNoTorneio({ id_torneio: torneio.id, decklist: deck.trim() });
      await alertarSucesso('Sucesso!', `Inscrição no torneio "${escaparHtml(torneio.nome)}" realizada!`);
      navigate('/');
    } catch (error) {
      alertarErro('Erro ao inscrever no torneio', error);
    } finally {
      setEnviando(false);
    }
  };

  // renderizar loading
  if (carregando) {
    return (
      <div className={estilos.container}>
        <main className={estilos.conteudo}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h2>Carregando dados do torneio...</h2>
          </div>
        </main>
      </div>
    );
  }

  // renderizar erro
  if (erro) {
    return (
      <div className={estilos.container}>
        <main className={estilos.conteudo}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h2>Erro ao carregar torneio</h2>
            <p>{erro}</p>
            <Button 
              label="Voltar" 
              onClick={() => window.history.back()}
              backgroundColor="var(--var-cor-terciaria)"
            />
          </div>
        </main>
      </div>
    );
  }

  // renderizar erro se torneio não encontrado
  if (!torneio) {
    return (
      <div className={estilos.container}>
        <main className={estilos.conteudo}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h2>Torneio não encontrado</h2>
            <p>O torneio solicitado não foi encontrado.</p>
            <Button 
              label="Voltar" 
              onClick={() => window.history.back()}
              backgroundColor="var(--var-cor-terciaria)"
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={estilos.container}>

      <main className={estilos.conteudo}>
        {/* Cabeçalho principal */}
        <h1 className={estilos.titulo}>Inscrição no Torneio</h1>
        <p className={estilos.subtitulo}>
          Complete suas informações para participar da {torneio.nome}
        </p>

        {/* Informações do torneio */}
        <section className={estilos.cartaoTorneio}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className={estilos.nomeTorneio}>{torneio.nome}</h2>
                <div className={estilos.jogadoresInscritos}>
                    <MdOutlinePeople /> {torneio.vagas_limitadas && torneio.qnt_vagas
                      ? `${torneio.qnt_inscritos} de ${torneio.qnt_vagas} vagas preenchidas`
                      : `${torneio.qnt_inscritos} inscritos (vagas ilimitadas)`}
                </div>
            </div>
            
            <p className={estilos.descricaoTorneio}>
              {torneio.descricao || ''}
            </p>
            
          </div>

          <div className={estilos.detalhesTorneio}>
            <div className={estilos.linhaInfo}>
              <div className={estilos.infoEsquerda}>
                <div className={estilos.itemInfo}>
                  <FaCalendarAlt /> <span>{formatarData(torneio.data_inicio)}</span>
                </div>
                <div className={estilos.itemInfo}>
                  <FaClock /> <span>{formatarHora(torneio.data_inicio)}</span>
                </div>
              </div>
              <div className={estilos.infoDireita}>
                <div className={estilos.itemInfo}>
                  <FaStore /> <span>{torneio.loja_nome}</span>
                </div>
                <div className={estilos.itemInfo}>
                  <FaMoneyBillAlt /> <span>{formatarPreco(torneio.inscricao_gratuita, torneio.valor_inscricao)}</span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Formulário de inscrição */}
        <section className={estilos.formulario}>
          <h3 className={estilos.tituloSessao}>Inscrição no Torneio</h3>
          <p className={estilos.subtituloSessao}>
            Preencha as informações abaixo para concluir sua inscrição.
          </p>

          <div className={estilos.grupoInputs}>
            <Input
              placeholder="Informe o link do seu deck na Liga Magic (opcional)"
              value={deck}
              onChange={(e) => setDeck(e.target.value)}
              type="text"
              name="link-deck"
              label="Link do Deck"
              labelColor={corLabelInputs}
            />
          </div>

          <div className={estilos.checkbox}>
            <input
              type="checkbox"
              id="termos"
              checked={aceiteTermos}
              onChange={(e) => setAceiteTermos(e.target.checked)}
            />
            <label htmlFor="termos">
              Aceito os termos e condições do torneio
            </label>
          </div>

          <div className={estilos.botoes}>
            <Button 
              label="Voltar" 
              onClick={() => window.history.back()}
              backgroundColor="var(--var-cor-terciaria)"
              disabled={enviando}
            />
            <Button 
              label={enviando ? "Enviando..." : "Confirmar Inscrição"}  
              onClick={enviarFormulario} 
              backgroundColor="var(--var-cor-primaria)"
              disabled={enviando}
            />
          </div>
        </section>

        {/* Regras do torneio */}
        <section className={estilos.regras}>
          <h3 className={estilos.tituloSessao}>Regras do Torneio</h3>
          <ul>
            {formatarRegras(torneio.regras).map((regra, index) => (
              <li key={index}>{regra}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default InscricaoTorneio;
