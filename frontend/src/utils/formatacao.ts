/**
 * Formatação de datas e valores no padrão brasileiro.
 *
 * Datas da API chegam em ISO 8601 com fuso (ex: "2025-03-10T19:00:00-03:00").
 */

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Data curta no formato DD.MM.AA (cards da home). */
export function formatarDataCurta(iso: string): string {
  const data = new Date(iso);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = String(data.getFullYear()).slice(-2);
  return `${dia}.${mes}.${ano}`;
}

export function formatarMoeda(valor: number): string {
  return formatadorMoeda.format(valor);
}

/** Texto do preço de inscrição de um torneio. */
export function formatarPreco(gratuito: boolean, valor: string | number | null): string {
  if (gratuito) return 'Gratuito';
  const numero = Number(valor);
  return valor === null || Number.isNaN(numero) ? 'Não informado' : formatarMoeda(numero);
}

/** Converte a data da API para o valor de um <input type="datetime-local"> (hora local do navegador). */
export function isoParaInputLocal(iso: string): string {
  const data = new Date(iso);
  const doisDigitos = (n: number) => String(n).padStart(2, '0');
  return (
    `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}` +
    `T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
  );
}

/** Converte o valor de um <input type="datetime-local"> para ISO 8601 com o fuso do navegador. */
export function inputLocalParaIso(valor: string): string {
  return new Date(valor).toISOString();
}

/** Máscara de moeda para campos de texto: "1500" -> "R$ 15,00". */
export function mascararMoeda(texto: string): string {
  const centavos = parseInt(texto.replace(/\D/g, '') || '0', 10);
  return formatarMoeda(centavos / 100);
}

/** Inverso de mascararMoeda: "R$ 15,00" -> 15. */
export function moedaParaNumero(texto: string): number {
  return parseInt(texto.replace(/\D/g, '') || '0', 10) / 100;
}
