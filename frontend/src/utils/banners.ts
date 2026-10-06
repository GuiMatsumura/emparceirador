import b1 from '../assets/b1.webp';
import b2 from '../assets/b2.webp';
import b3 from '../assets/b3.webp';

/** Banners disponíveis. O backend guarda o nome original do arquivo (Torneio.banner), por isso as chaves .png. */
export const BANNERS: Record<string, string> = {
  'b1.png': b1,
  'b2.png': b2,
  'b3.png': b3,
};

const PADRAO = Object.values(BANNERS);

/** Imagem do banner do torneio; sem banner, escolhe uma fixa a partir do id. */
export function imagemDoBanner(banner: string, torneioId: number): string {
  return BANNERS[banner] ?? PADRAO[torneioId % PADRAO.length];
}
