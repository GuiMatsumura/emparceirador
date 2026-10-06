import { useEffect, useRef } from 'react';

/**
 * Executa `callback` a cada `ms` milissegundos enquanto `ativo` for true.
 * Sempre chama a versão mais recente do callback (sem reiniciar o timer a cada render).
 */
export function useIntervalo(callback: () => void, ms: number, ativo = true) {
  const atual = useRef(callback);

  useEffect(() => {
    atual.current = callback;
  });

  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(() => atual.current(), ms);
    return () => clearInterval(id);
  }, [ms, ativo]);
}
