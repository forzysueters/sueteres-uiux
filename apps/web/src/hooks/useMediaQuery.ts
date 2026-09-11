import { useEffect, useState } from 'react';

/**
 * Observa uma media query do CSS a partir do React.
 *
 * Existe porque alguns layouts (a grade posicional da planta, o tamanho do
 * medidor de saúde) precisam mudar de *estrutura* — não só de classe — entre
 * celular e desktop, e isso não dá para expressar em estilo inline.
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const sync = () => setMatches(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    // Rede de seguranca: em alguns ambientes (viewport emulado, rotacao de
    // tela) o evento 'change' da media query nao dispara, mas o resize sim.
    window.addEventListener('resize', sync);
    return () => {
      mql.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, [query]);

  return matches;
};

/** Breakpoint `sm` do Tailwind: true abaixo de 640px. */
export const useIsMobile = () => useMediaQuery('(max-width: 639px)');
