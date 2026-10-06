/**
 * Página de Login
 *
 * RESPONSABILIDADES:
 * 1. Renderizar a estrutura visual da página de login (fundo, card).
 * 2. Utilizar componentes reutilizáveis (Input, Botão) para construir o formulário.
 * 3. Manter o estado dos campos de email e senha.
 * 4. Chamar a função de login do AuthContexto ao submeter o formulário.
 * 5. Redirecionar o utilizador após um login bem-sucedido.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useLocation, useNavigate, Link} from 'react-router-dom';
import { useSessao } from '../../../contextos/AuthContexto';
import styles from './styles.module.css';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import { alertarAviso } from '../../../utils/alertas';


const PaginaLogin = () => {
  // Hooks do React para gerir o estado e a navegação.
  const navigate = useNavigate();
  const location = useLocation();
  const { login, usuario, qtdCaracteresSenha } = useSessao();

  // Estados locais para armazenar os valores dos campos do formulário.
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false); 
  const corTextInputs = "var(--cor-texto-principal)";
  const corBackgroundInputs = "#FFFFFF";


  // Página que exigiu login (RotaSegura ou card de torneio guardam em location.state.from).
  const deOndeVeio: string = location.state?.from?.pathname || '/';

  // Assim que o login (ou a sessão existente) define o usuário, volta para a página de origem.
  useEffect(() => {
    if (usuario) navigate(deOndeVeio, { replace: true });
  }, [usuario, deOndeVeio, navigate]);

  // Função executada quando o formulário é submetido.
  const handleSubmit = async (evento: FormEvent) => {
    evento.preventDefault();
    
    if (!email || !senha) {
      alertarAviso('Erro no login', 'Preencha todos os campos.');
      return;
    }

    try {
      setLoading(true);
      await login({ email, password: senha });
    } catch {
      // O alerta de erro já é exibido pelo AuthContexto.
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h2 className={styles.title}>Login</h2>

        <Input
          type="email"
          name="email"
          label="Email"
          placeholder="exemplo@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          backgroundColor={corBackgroundInputs}
          textColor={corTextInputs}
        />

        <Input
          type="password"
          name="senha"
          label="Senha"
          placeholder="**********"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          minLength={qtdCaracteresSenha}
          backgroundColor={corBackgroundInputs}
          textColor={corTextInputs}

        />
        
        <Button
          label="Entrar"
          type="submit"
          disabled={loading}
        />

        <Link to="/recuperar-senha/" className={styles.link}>
          Esqueceu a senha?
        </Link>

        <Link to="/cadastrar/" className={styles.link}>
          Ainda não possui conta? Cadastre-se
        </Link>
      
      </form> 
    </div>
  );
}

export default PaginaLogin;