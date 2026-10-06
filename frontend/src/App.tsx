import { useCallback, useEffect, useState } from 'react';
import { FaUsers } from 'react-icons/fa';

import estilos from './App.module.css';
import CardTorneio from './components/CardTorneio';
import ModalInscricaoJogador from './components/ModalInscricaoJogador';
import Navbar from './components/Navbar';
import { useSessao } from './contextos/AuthContexto';
import { buscarTorneiosAtivos } from './services/torneioServico';
import type { ITorneio } from './tipos/tipos';
import { imagemDoBanner } from './utils/banners';
import { mensagemDeErro } from './utils/erros';
import { formatarDataCurta, formatarHora } from './utils/formatacao';

function tagsDoTorneio(torneio: ITorneio) {
  const tags = [{ texto: '2v2', icone: <FaUsers /> }, { texto: torneio.inscricao_gratuita ? 'Gratuito' : 'Pago' }];
  if (torneio.vagas_limitadas) tags.push({ texto: 'Vagas limitadas' });
  return tags;
}

/** Home: hero + torneios abertos/em andamento (para LOJA, apenas os dela). */
function App() {
  const { usuario } = useSessao();
  const [torneios, setTorneios] = useState<ITorneio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [torneioParaInscrever, setTorneioParaInscrever] = useState<ITorneio | null>(null);

  const carregarTorneios = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setTorneios(await buscarTorneiosAtivos());
    } catch (e) {
      setErro(mensagemDeErro(e));
      setTorneios([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarTorneios();
  }, [carregarTorneios]);

  const ehLoja = usuario?.tipo === 'LOJA';

  const renderizarLista = () => {
    if (carregando) {
      return (
        <div className={estilos.estadoContainer}>
          <h4>Carregando torneios...</h4>
        </div>
      );
    }
    if (erro) {
      return (
        <div className={estilos.estadoContainer}>
          <h4>Erro ao carregar torneios</h4>
          <p>{erro}</p>
        </div>
      );
    }
    if (!torneios.length) {
      return (
        <div className={estilos.estadoContainer}>
          <h4>Nenhum torneio disponível no momento</h4>
        </div>
      );
    }

    return (
      <div className={estilos.gridTorneios}>
        {torneios.map((torneio) => (
          <CardTorneio
            key={torneio.id}
            id={torneio.id}
            imagem={imagemDoBanner(torneio.banner, torneio.id)}
            titulo={torneio.nome}
            data={formatarDataCurta(torneio.data_inicio)}
            hora={formatarHora(torneio.data_inicio)}
            tags={tagsDoTorneio(torneio)}
            onInscreverJogador={ehLoja ? () => setTorneioParaInscrever(torneio) : undefined}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={estilos.app}>
      <Navbar />

      <section className={estilos.hero}>
        <div className={estilos.heroConteudo}>
          <h1 className={estilos.titulo}>Commander 150</h1>
          <p className={estilos.subtitulo}>
            Sistema para torneios 2v2 de Magic: The Gathering. <br />
            Encontre seu parceiro, monte sua estratégia e domine o multiverso!
          </p>
        </div>
      </section>

      <section className={estilos.listaTorneios}>
        <h2 className={estilos.tituloSecao}>{ehLoja ? 'Meus torneios' : 'Torneios disponíveis'}</h2>
        {renderizarLista()}
      </section>

      {torneioParaInscrever && (
        <ModalInscricaoJogador
          torneioId={torneioParaInscrever.id}
          torneioNome={torneioParaInscrever.nome}
          onClose={() => setTorneioParaInscrever(null)}
          onSuccess={carregarTorneios}
        />
      )}
    </div>
  );
}

export default App;
