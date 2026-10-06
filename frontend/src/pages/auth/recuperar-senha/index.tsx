import styles from "./styles.module.css";
import Input from "../../../components/Input";
import Button from "../../../components/Button";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useSessao } from '../../../contextos/AuthContexto';
import { solicitarTokenRecuperacaoSenha, validarTokenRecuperacao} from '../../../services/authServico';
import { alertarErro } from '../../../utils/alertas';


export default function PaginaRecuperarSenha() {
    const [email, setEmail] = useState("");
    const [token, setToken] = useState("");
    const [etapa, setEtapa] = useState<"email" | "token" | "finalizado">("email");
    const {qtdCaracteresToken } = useSessao();
    const [isLoading, setIsLoading] = useState(false);
    const corTextInputs = "var(--cor-texto-principal)";
  const corBackgroundInputs = "var(--cor-branca)";

    // Função para enviar o email e solicitar o Token de redefinição de senha.
    const handleEnviarEmail = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  try {
    await solicitarTokenRecuperacaoSenha(email);
    setEtapa("token");
  } catch (erro) {
    alertarErro("Erro na recuperação de senha", erro);
  } finally {
    setIsLoading(false);
  }
};


    // Função para enviar o Token e solicitar nova senha
    const handleEnviarToken = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  try {
    await validarTokenRecuperacao(email, token);
    setEtapa("finalizado");
  } catch (erro) {
    alertarErro("Erro na recuperação de senha", erro);
  } finally {
    setIsLoading(false);
  }
};



    const handleTrocarEmail = () => {
        setEmail("");
        setToken("");
        setEtapa("email");
    };

    const renderConteudoEtapa = () => {
        switch (etapa) {
        case "email":
            return (
            <>
                <h2 className={styles.title}>Redefinir senha</h2>
                <p className={styles.subtitle}>
                Digite o seu email no campo abaixo e lhe enviaremos uma nova senha.
                </p>
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
            </>
            );
        case "token":
            return (
            <>
                <h2 className={styles.title}>Validar token</h2>
                <p className={styles.subtitle}>
                Enviamos um código para o seu email. Cole abaixo para confirmar sua identidade.
                </p>
                <Input
                type="text"
                name="token"
                label="Token"
                placeholder="Digite o token aqui"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                minLength={qtdCaracteresToken}
                backgroundColor={corBackgroundInputs}
                textColor={corTextInputs}
                />
                
                <Button
                    label="Retornar e Alterar Email"
                    type="submit"
                    onClick={handleTrocarEmail}
                    backgroundColor="#5b6975ff"
                />
            </>
            );
        case "finalizado":
            return (
            <>
                <h2 className={styles.title}>Senha enviada!</h2>
                <p className={styles.subtitle}>
                Sua nova senha foi enviada para o email informado. Recomendamos que você a altere após o login.
                </p>
                <div className={styles.finalActions}>
                <Link to="/login/" className={styles.link}>
                    Ir para tela de login
                </Link>
                </div>
            </>
            );
    }
  };

  return (
    <div className={styles.container}>
      <form
        className={styles.card}
        onSubmit={etapa === "email" ? handleEnviarEmail : handleEnviarToken}
      >
        {renderConteudoEtapa()}

        {etapa !== "finalizado" && (
          <div className={styles.buttonRow}>
            <Button
                label={isLoading ? "Aguarde..." : etapa === "email" ? "Enviar" : "Enviar token"}
                type="submit"
                disabled={isLoading}
            />

          </div>
        )}

        {etapa === "email" && (
            <Link to="/login/" className={styles.link}>
              Já possui cadastro? Faça seu login!
            </Link>
        )}
      </form>
    </div>
  );
}
