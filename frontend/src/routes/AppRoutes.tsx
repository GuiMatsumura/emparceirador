import { Route, Routes } from 'react-router-dom';

import App from '../App';
import Layout from '../components/Layout';
import Intervalo from '../pages/Mesa/intervalo';
import PaginaAlterarSenha from '../pages/auth/alterar-senha';
import PaginaCadastrar from '../pages/auth/cadastrar';
import PaginaLogin from '../pages/auth/login';
import PaginaRecuperarSenha from '../pages/auth/recuperar-senha';
import TorneioRouter from '../pages/Torneio/TorneioRouter';
import CriarTorneio from '../pages/Torneio/criar';
import HistoricoTorneios from '../pages/Torneio/historico';
import InscricaoTorneio from '../pages/Torneio/inscrever';
import { RotaSegura } from './RotaSegura';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Públicas, sem layout (sem navbar) */}
      <Route path="/" element={<App />} />
      <Route path="/login/" element={<PaginaLogin />} />
      <Route path="/recuperar-senha/" element={<PaginaRecuperarSenha />} />
      <Route path="/cadastrar/" element={<PaginaCadastrar />} />

      {/* Exigem login */}
      <Route element={<RotaSegura />}>
        <Route element={<Layout />}>
          <Route path="/alterar-senha/" element={<PaginaAlterarSenha />} />
          <Route path="/historico/" element={<HistoricoTorneios />} />
          <Route path="/inscricao-torneio/:id" element={<InscricaoTorneio />} />
          <Route path="/torneios/:id" element={<TorneioRouter />} />
          <Route path="/intervalo/:id" element={<Intervalo />} />
        </Route>
      </Route>

      {/* Exigem login de loja ou admin */}
      <Route element={<RotaSegura tipos={['LOJA', 'ADMIN']} />}>
        <Route element={<Layout />}>
          <Route path="/criar-evento/" element={<CriarTorneio />} />
        </Route>
      </Route>
    </Routes>
  );
}
