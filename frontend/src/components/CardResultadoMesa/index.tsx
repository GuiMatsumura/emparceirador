import { useState, type FormEvent } from 'react';

import Button from '../Button';
import Input from '../Input';
import styles from './styles.module.css';

interface CardResultadoMesaProps {
  onSubmit: (pontuacaoTime1: number, pontuacaoTime2: number) => void;
  pontuacaoInicialTime1?: number;
  pontuacaoInicialTime2?: number;
  title?: string;
  subtitle?: string;
}

/** Formulário de placar de uma mesa (vitórias de cada time). */
const CardResultadoMesa = ({
  onSubmit,
  pontuacaoInicialTime1 = 0,
  pontuacaoInicialTime2 = 0,
  title = 'Informar Resultado da Mesa',
  subtitle = 'Preencha as vitórias de cada time',
}: CardResultadoMesaProps) => {
  const [time1, setTime1] = useState(String(pontuacaoInicialTime1));
  const [time2, setTime2] = useState(String(pontuacaoInicialTime2));

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(Number(time1), Number(time2));
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.subtitle}>{subtitle}</p>

      <form onSubmit={enviar} className={styles.form}>
        <div className={styles.inputsContainer}>
          {[
            { nome: 'time1', rotulo: 'Vitórias do Time 1', valor: time1, alterar: setTime1 },
            { nome: 'time2', rotulo: 'Vitórias do Time 2', valor: time2, alterar: setTime2 },
          ].map(({ nome, rotulo, valor, alterar }) => (
            <div key={nome} className={styles.inputWrapper}>
              <Input
                type="numero"
                name={nome}
                label={rotulo}
                value={valor}
                onChange={(e) => alterar(e.target.value)}
                backgroundColor="#1A2025"
                textColor="#fff"
                labelColor="#fff"
              />
            </div>
          ))}
        </div>

        <Button
          label="Confirmar Resultado"
          type="submit"
          width="100%"
          backgroundColor="#003A70"
          textColor="#fff"
          fontSize="16px"
          fontWeight={500}
          borderRadius="4px"
        />
      </form>
    </div>
  );
};

export default CardResultadoMesa;
