import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useSessao } from '../contextos/AuthContexto';
import type { TipoUsuario } from '../tipos/tipos';

interface RotaSeguraProps {
  /** Se informado, só usuários desses tipos acessam; os demais voltam para a home. */
  tipos?: TipoUsuario[];
}

/**
 * Protege um grupo de rotas: exige sessão ativa (e, opcionalmente, um tipo de usuário).
 * Sem sessão, redireciona para o login guardando a página de origem.
 */
export const RotaSegura = ({ tipos }: RotaSeguraProps) => {
  const { usuario, carregandoSessao } = useSessao();
  const location = useLocation();

  if (carregandoSessao) {
    return <div>Carregando sessão...</div>;
  }
  if (!usuario) {
    return <Navigate to="/login/" replace state={{ from: location }} />;
  }
  if (tipos && !tipos.includes(usuario.tipo)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};
