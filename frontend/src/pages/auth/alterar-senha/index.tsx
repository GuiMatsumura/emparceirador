/**
 * Página de Alterar Senha
 *
 * RESPONSABILIDADES:
 * 1. Renderizar a estrutura visual da página de Alteração de senha (fundo, card).
 * 2. Utilizar componentes reutilizáveis (Input, Botão) para construir o formulário.
 * 3. Manter o estado dos campos
 * 4. Chamar a função de Alteração do authServico ao submeter o formulário.
 * 5. Redirecionar o utilizador após um cadastro bem-sucedido.
 */

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessao } from '../../../contextos/AuthContexto';
import styles from './styles.module.css';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import { alterarSenhaUsuario} from '../../../services/authServico';
import { alertarAviso, alertarErro, alertarSucesso } from '../../../utils/alertas';


const PaginaAlterarSenha = () => {
  // Hooks do React para gerir o estado e a navegação.
  const navigate = useNavigate();
  const { qtdCaracteresSenha, usuario, resetUsuario  } = useSessao();
  const [loading, setLoading] = useState(false); 

  // Estados locais para armazenar os valores dos campos do formulário.
  const [senhaAntiga, setSenhaAntiga] = useState('');
  const [novaSenha, setNovaSenha] = useState('');

  // Estilos
  const corTextInputs = "var(--cor-texto-principal)";
  const corBackgroundInputs = "#FFFFFF";

  // Função executada quando o formulário é submetido.
  const handleSubmit = async (evento: FormEvent) => {
    evento.preventDefault();

    if (!senhaAntiga || !novaSenha) {
      alertarAviso('Erro na alteração', 'Preencha todos os campos.');
      return;
    }
    if (!usuario) {
      resetUsuario();
      navigate('/login/');
      return;
    }

    try {
      setLoading(true);
      await alterarSenhaUsuario(usuario.id, senhaAntiga, novaSenha);
      // Trocar a senha encerra a sessão no servidor: pede login de novo.
      await alertarSucesso('Senha alterada com sucesso!', 'Faça login novamente para continuar.');
      resetUsuario();
      navigate('/login/');
    } catch (erro) {
      alertarErro('Erro na alteração', erro);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h2 className={styles.title}>Alterar Senha</h2>
        <Input
          type="password"
          name="senha-antiga"
          label="Senha Atual"
          placeholder="**********"
          value={senhaAntiga}
          onChange={(e) => setSenhaAntiga(e.target.value)}
          required
          minLength={qtdCaracteresSenha}
          backgroundColor={corBackgroundInputs}
          textColor={corTextInputs}
        />
        <Input
          type="password"
          name="nova-senha"
          label="Nova Senha"
          placeholder="**********"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          required
          minLength={qtdCaracteresSenha}
          backgroundColor={corBackgroundInputs}
          textColor={corTextInputs}
        />
        
        <Button
          label="Alterar Senha"
          type="submit"
          disabled={loading}
        />
        <Button
          label="Cancelar"
          type="button"
          onClick={() => navigate(-1)}
        />
      
      </form> 
    </div>
  );
}

export default PaginaAlterarSenha;