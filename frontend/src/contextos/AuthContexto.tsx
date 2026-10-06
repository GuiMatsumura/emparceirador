/**
 * Estado global de autenticação.
 *
 * O <GerenciadorSessao> (em main.tsx) verifica a sessão ao carregar a aplicação e expõe,
 * via useSessao(), o usuário logado e as funções de login/logout.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { efetuarLogin, efetuarLogout, verificarSessao } from '../services/authServico';
import type { ILoginCredenciais, IUsuario } from '../tipos/tipos';
import { alertarErro } from '../utils/alertas';

/** Tamanho mínimo aceito no campo de senha do login (contas antigas podem ter senhas curtas). */
const QTD_MINIMA_SENHA = 4;
/** Tamanho do token de redefinição de senha enviado por e-mail. */
const QTD_CARACTERES_TOKEN = 16;

interface IAuthContexto {
  usuario: IUsuario | null;
  carregandoSessao: boolean;
  qtdCaracteresSenha: number;
  qtdCaracteresToken: number;
  /** Faz login; em caso de erro, mostra o alerta e relança a exceção. */
  login: (credenciais: ILoginCredenciais) => Promise<void>;
  logout: () => Promise<void>;
  /** Limpa o usuário localmente (ex: após trocar a senha a sessão é encerrada no servidor). */
  resetUsuario: () => void;
}

const AuthContexto = createContext<IAuthContexto | undefined>(undefined);

export const GerenciadorSessao = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<IUsuario | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  useEffect(() => {
    verificarSessao()
      .then(setUsuario)
      .catch((erro) => {
        setUsuario(null);
        alertarErro('Erro ao verificar a sessão', erro);
      })
      .finally(() => setCarregandoSessao(false));
  }, []);

  const login = useCallback(async (credenciais: ILoginCredenciais) => {
    try {
      setUsuario(await efetuarLogin(credenciais));
    } catch (erro) {
      alertarErro('Erro no login', erro);
      throw erro;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await efetuarLogout();
      setUsuario(null);
    } catch (erro) {
      alertarErro('Erro ao sair', erro);
    }
  }, []);

  const resetUsuario = useCallback(() => setUsuario(null), []);

  const valor = useMemo(
    () => ({
      usuario,
      carregandoSessao,
      qtdCaracteresSenha: QTD_MINIMA_SENHA,
      qtdCaracteresToken: QTD_CARACTERES_TOKEN,
      login,
      logout,
      resetUsuario,
    }),
    [usuario, carregandoSessao, login, logout, resetUsuario],
  );

  return <AuthContexto.Provider value={valor}>{children}</AuthContexto.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSessao = (): IAuthContexto => {
  const contexto = useContext(AuthContexto);
  if (contexto === undefined) {
    throw new Error('useSessao deve ser usado dentro de um GerenciadorSessao');
  }
  return contexto;
};
