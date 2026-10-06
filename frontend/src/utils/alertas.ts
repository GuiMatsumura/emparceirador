import Swal, { type SweetAlertIcon } from 'sweetalert2';

import { mensagemDeErro } from './erros';

export const CORES = {
  sucesso: '#46AF87',
  perigo: '#DC2626',
  neutro: '#6c757d',
  destaque: '#9b80b6',
  alerta: '#f39c12',
} as const;

interface OpcoesConfirmacao {
  titulo: string;
  /** Conteúdo em HTML. Não interpolar texto vindo do usuário sem escapar (use escaparHtml). */
  html?: string;
  texto?: string;
  confirmar?: string;
  cancelar?: string;
  icone?: SweetAlertIcon;
  corConfirmar?: string;
}

/** Pergunta de confirmação. Resolve true se o usuário confirmou. */
export async function confirmar({
  titulo,
  html,
  texto,
  confirmar = 'Confirmar',
  cancelar = 'Cancelar',
  icone = 'question',
  corConfirmar = CORES.sucesso,
}: OpcoesConfirmacao): Promise<boolean> {
  const resultado = await Swal.fire({
    titleText: titulo,
    html,
    text: texto,
    icon: icone,
    showCancelButton: true,
    confirmButtonText: confirmar,
    cancelButtonText: cancelar,
    confirmButtonColor: corConfirmar,
    cancelButtonColor: CORES.neutro,
    reverseButtons: true,
    focusCancel: true,
  });
  return resultado.isConfirmed;
}

export function alertarSucesso(titulo: string, html?: string) {
  return Swal.fire({ titleText: titulo, html, icon: 'success', confirmButtonColor: CORES.sucesso });
}

export function alertarAviso(titulo: string, texto?: string) {
  return Swal.fire({ titleText: titulo, text: texto, icon: 'warning', confirmButtonColor: CORES.neutro });
}

/** Mostra o erro da API (ou um texto) em um alerta. */
export function alertarErro(titulo: string, erro: unknown) {
  const texto = typeof erro === 'string' ? erro : mensagemDeErro(erro);
  return Swal.fire({ titleText: titulo, text: texto, icon: 'error', confirmButtonColor: CORES.perigo });
}

export function avisoRapido(titulo: string, texto?: string) {
  return Swal.fire({
    titleText: titulo,
    text: texto,
    icon: 'success',
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
  });
}

/** Escapa texto para uso seguro dentro do `html` dos alertas. */
export function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
