import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import estilos from "./styles.module.css";

import Input from "../../../components/Input";
import Button from "../../../components/Button";
import Radio from "../../../components/Radio";

import { criarTorneio } from "../../../services/torneioServico";
import type { ITorneioEntrada } from "../../../tipos/tipos";
import { alertarAviso, alertarErro, alertarSucesso, escaparHtml } from "../../../utils/alertas";
import { BANNERS } from "../../../utils/banners";
import { mensagemDeErro } from "../../../utils/erros";
import { inputLocalParaIso, mascararMoeda, moedaParaNumero } from "../../../utils/formatacao";

const CriarTorneio: React.FC = () => {
  const navigate = useNavigate();

  // Estados para informações básicas
  const [nomeTorneio, setNomeTorneio] = useState("");
  const [dataHoraTorneio, setDataHoraTorneio] = useState("");
  const [bannerSelecionado, setBannerSelecionado] = useState("b1.png");
  const [descricao, setDescricao] = useState("");
  const [regrasTorneio, setRegrasTorneio] = useState(`• Formato Commander padrão (100 cartas)
• Time limit: 50 minutos por partida
• Banlist oficial da Wizards of the Coast
• Cada dupla deve ter decks de cores diferentes
• Proxies não são permitidas
• Comportamento respeitoso é obrigatório`);

  // Estados para inscrições e custos
  const [modalidadeInscricao, setModalidadeInscricao] = useState("gratuito");
  const [valorInscricao, setValorInscricao] = useState("R$ 0,00");
  const [vagasLimitadas, setVagasLimitadas] = useState("limitadas");
  const [capacidadeMaxima, setCapacidadeMaxima] = useState("");

  // Estados para pontuações
  const [pontuacaoVitoria, setPontuacaoVitoria] = useState("3");
  const [pontuacaoDerrota, setPontuacaoDerrota] = useState("0");
  const [pontuacaoEmpate, setPontuacaoEmpate] = useState("1");
  const [pontuacaoBye, setPontuacaoBye] = useState("3");
  const [quantidadeRodadas, setQuantidadeRodadas] = useState("");

  // Estados para controle da API
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const corLabelInputs = "#FFFFFF";

  // Monta o payload da API a partir do formulário
  const montarDados = (): ITorneioEntrada => ({
    nome: nomeTorneio,
    descricao,
    regras: regrasTorneio,
    banner: bannerSelecionado,
    vagas_limitadas: vagasLimitadas === "limitadas",
    qnt_vagas: vagasLimitadas === "limitadas" ? parseInt(capacidadeMaxima) || null : null,
    inscricao_gratuita: modalidadeInscricao === "gratuito",
    valor_inscricao: modalidadeInscricao === "pago" ? moedaParaNumero(valorInscricao) : null,
    pontuacao_vitoria: parseInt(pontuacaoVitoria) || 3,
    pontuacao_derrota: parseInt(pontuacaoDerrota) || 0,
    pontuacao_empate: parseInt(pontuacaoEmpate) || 1,
    pontuacao_bye: parseInt(pontuacaoBye) || 3,
    quantidade_rodadas: parseInt(quantidadeRodadas) || null,
    data_inicio: inputLocalParaIso(dataHoraTorneio),
  });

  // Função de envio do formulário
  const enviarFormulario = async () => {
    // Validações
    if (!nomeTorneio || !dataHoraTorneio) {
      alertarAviso('Atenção', 'Preencha os campos obrigatórios: Nome do Torneio e Data/Hora do Torneio.');
      return;
    }

    if (vagasLimitadas === "limitadas" && !capacidadeMaxima) {
      alertarAviso('Atenção', 'Informe a capacidade máxima de jogadores.');
      return;
    }

    // Limpar erro anterior
    setErro(null);
    setCarregando(true);

    try {
      const torneioCriado = await criarTorneio(montarDados());
      await alertarSucesso('Sucesso!', `Torneio "${escaparHtml(torneioCriado.nome)}" criado com sucesso!`);
      navigate(`/torneios/${torneioCriado.id}`);
    } catch (error) {
      setErro(mensagemDeErro(error));
      alertarErro('Erro ao criar torneio', error);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className={estilos.container}>
      <main className={estilos.conteudo}>
        {/* Cabeçalho principal */}
        <h1 className={estilos.titulo}>Criação de Torneio</h1>
        <p className={estilos.subtitulo}>
          Complete suas informações para criar um torneio
        </p>

        {/* Card 1: Informações Básicas do Torneio */}
        <section className={estilos.cartao}>
          <h3 className={estilos.tituloSessao}>Informações Básicas do Torneio</h3>
          
           <div className={estilos.grupoInputs}>
             <Input
               placeholder="Digite o nome do torneio..."
               value={nomeTorneio}
               onChange={(e) => setNomeTorneio(e.target.value)}
               type="text"
               name="nome-torneio"
               label="Nome do Torneio*"
               labelColor={corLabelInputs}
               required
             />
             <div className={estilos.inputComIcone}>
               <label className={estilos.labelInput}>Data e Hora do Torneio*</label>
               <input
                 type="datetime-local"
                 value={dataHoraTorneio}
                 onChange={(e) => setDataHoraTorneio(e.target.value)}
                 className={estilos.inputDatetime}
                 required
               />
             </div>
           </div>

           <div className={estilos.grupoInputs}>
             <div className={estilos.selecaoBanner}>
               <label className={estilos.labelBanner}>Banner do Torneio</label>
               <div className={estilos.opcoesBanner}>
                 {Object.entries(BANNERS).map(([nome, imagem]) => (
                   <div 
                     key={nome}
                     className={`${estilos.opcaoBanner} ${bannerSelecionado === nome ? estilos.opcaoBannerSelecionada : ''}`}
                     onClick={() => setBannerSelecionado(nome)}
                   >
                     <img src={imagem} alt={`Banner ${nome}`} className={estilos.imagemBanner} />
                     <span className={estilos.nomeBanner}>{nome}</span>
                   </div>
                 ))}
               </div>
             </div>
           </div>

          <div className={estilos.textareaContainer}>
            <label className={estilos.labelTextarea}>Descrição</label>
            <textarea
              className={estilos.textarea}
              placeholder="Adicione uma descrição do torneio..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
            />
          </div>
        </section>

        {/* Card 2: Inscrições e Custos */}
        <section className={estilos.cartao}>
          <h3 className={estilos.tituloSessao}>Inscrições e Custos</h3>
          
        <div className={estilos.grupoRadio}>
          <Radio
            labelPrincipal="Modalidade de Inscrição"
            name="modalidade"
            opcoes={[
              { valor: "gratuito", rotulo: "Gratuito" },
              { valor: "pago", rotulo: "Pago" }
            ]}
            valorSelecionado={modalidadeInscricao}
            textColor="#FFFFFF"
            onChange={(e) => {
              setModalidadeInscricao(e.target.value);
              if (e.target.value === "gratuito") {
                setValorInscricao("R$ 0,00");
              }
            }}
          />
        </div>

           {modalidadeInscricao === "pago" && (
             <div className={estilos.grupoInputs}>
               <Input
                 placeholder="R$ 0,00"
                 value={valorInscricao}
                 onChange={(e) => setValorInscricao(mascararMoeda(e.target.value))}
                 type="text"
                 name="valor-inscricao"
                 label="Valor da Inscrição"
                 labelColor={corLabelInputs}
               />
             </div>
           )}

        <div className={estilos.grupoRadio}>
          <Radio
            labelPrincipal="Vagas para o torneio"
            name="vagas"
            opcoes={[
              { valor: "ilimitadas", rotulo: "Ilimitadas" },
              { valor: "limitadas", rotulo: "Limitadas" }
            ]}
            valorSelecionado={vagasLimitadas}
            textColor="#FFFFFF"
            onChange={(e) => setVagasLimitadas(e.target.value)}
          />
        </div>

          {vagasLimitadas === "limitadas" && (
            <div className={estilos.inputLimitado}>
            <Input
              placeholder="Digite o número de jogadores"
              value={capacidadeMaxima}
              onChange={(e) => setCapacidadeMaxima(e.target.value)}
              type="numero"
              name="capacidade-maxima"
              label="Capacidade Máxima de Jogadores"
              labelColor={corLabelInputs}
            />
            </div>
          )}
         </section>

         {/* Card 3: Sistema de Pontuação */}
         <section className={estilos.cartao}>
           <h3 className={estilos.tituloSessao}>Sistema de Pontuação</h3>
           
           <div className={estilos.grupoInputs}>
             <Input
               placeholder="3"
               value={pontuacaoVitoria}
               onChange={(e) => setPontuacaoVitoria(e.target.value)}
               type="numero"
               name="pontuacao-vitoria"
               label="Pontos por Vitória"
               labelColor={corLabelInputs}
             />
             <Input
               placeholder="0"
               value={pontuacaoDerrota}
               onChange={(e) => setPontuacaoDerrota(e.target.value)}
               type="numero"
               name="pontuacao-derrota"
               label="Pontos por Derrota"
               labelColor={corLabelInputs}
             />
           </div>

           <div className={estilos.grupoInputs}>
             <Input
               placeholder="1"
               value={pontuacaoEmpate}
               onChange={(e) => setPontuacaoEmpate(e.target.value)}
               type="numero"
               name="pontuacao-empate"
               label="Pontos por Empate"
               labelColor={corLabelInputs}
             />
             <Input
               placeholder="3"
               value={pontuacaoBye}
               onChange={(e) => setPontuacaoBye(e.target.value)}
               type="numero"
               name="pontuacao-bye"
               label="Pontos por Bye"
               labelColor={corLabelInputs}
             />
           </div>

           <div className={estilos.grupoInputs}>
             <Input
               placeholder="Sem limite"
               value={quantidadeRodadas}
               onChange={(e) => setQuantidadeRodadas(e.target.value)}
               type="numero"
               name="quantidade-rodadas"
               label="Quantidade de Rodadas (opcional)"
               labelColor={corLabelInputs}
             />
           </div>
         </section>

         {/* Card 4: Regras do Torneio */}
        <section className={estilos.cartao}>
          <h3 className={estilos.tituloSessao}>Regras do Torneio</h3>
          <div className={estilos.textareaContainer}>
            <textarea
              className={estilos.textarea}
              placeholder="Digite as regras do torneio..."
              value={regrasTorneio}
              onChange={(e) => setRegrasTorneio(e.target.value)}
              rows={8}
            />
          </div>
        </section>

        {/* Botões de ação */}
        <div className={estilos.botoes}>
          <Button 
            label="Cancelar" 
            onClick={() => window.history.back()}
            backgroundColor="var(--var-cor-terciaria)"
            disabled={carregando}
          />
          <Button 
            label={carregando ? "Criando..." : "Criar Torneio"}  
            onClick={enviarFormulario} 
            backgroundColor="var(--var-cor-primaria)"
            disabled={carregando}
          />
        </div>

        {/* Exibir erro se houver */}
        {erro && (
          <div className={estilos.erroContainer}>
            <p className={estilos.erroTexto}>{erro}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default CriarTorneio;
