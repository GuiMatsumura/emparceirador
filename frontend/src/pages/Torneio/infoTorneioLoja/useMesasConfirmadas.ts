import { useCallback, useEffect, useState } from 'react';

/**
 * Mesas cujo resultado a loja já conferiu (marcação só visual, guardada no navegador).
 *
 * A API não tem esse conceito: a "confirmação" grava o placar via editar_manual e esta marca
 * apenas tira o aviso "Revisar dados" do card.
 */
export function useMesasConfirmadas(torneioId: number) {
  const chave = `mesasConfirmadas_torneio_${torneioId}`;

  const [confirmadas, setConfirmadas] = useState<Set<number>>(() => {
    try {
      return new Set<number>(JSON.parse(localStorage.getItem(chave) ?? '[]'));
    } catch {
      return new Set<number>();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(chave, JSON.stringify([...confirmadas]));
    } catch {
      // Armazenamento indisponível (ex: modo privado): a marcação vale só nesta sessão
    }
  }, [chave, confirmadas]);

  const confirmar = useCallback((mesaId: number) => {
    setConfirmadas((atual) => new Set(atual).add(mesaId));
  }, []);

  return { confirmadas, confirmar };
}
