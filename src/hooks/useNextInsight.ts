import { useEffect, useRef, useState } from 'react';

/**
 * Contagem regressiva até o próximo diagnóstico do modelo.
 *
 * O avaliador roda no banco num cron de cinco em cinco minutos (migração
 * 0018), ou seja, sempre no minuto cheio múltiplo de cinco. Isso é o que torna a contagem honesta: ela
 * não é um cronômetro decorativo que começa quando a tela abre — é derivada do
 * relógio de parede, o mesmo que o cron do Postgres segue. Dois operadores em
 * máquinas diferentes veem o mesmo número descendo, e o "0" cai junto com a
 * execução de verdade.
 *
 * `onDue` dispara logo depois do zero, com uma folga: o cron ainda precisa ler
 * a janela, calcular e gravar. Buscar no instante exato traria o diagnóstico
 * anterior e a tela ficaria um ciclo atrasada.
 */
const CYCLE_SECONDS = 5 * 60;
const SETTLE_MS = 4000;

/** Segundos até o próximo múltiplo de 5 minutos no relógio de parede. */
export const secondsToNextCycle = (now: Date = new Date()): number => {
  const elapsed = (now.getMinutes() % 5) * 60 + now.getSeconds();
  return CYCLE_SECONDS - elapsed;
};

export const useNextInsight = (onDue?: () => void) => {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsToNextCycle());
  const dueRef = useRef(onDue);
  dueRef.current = onDue;

  useEffect(() => {
    let settle: number | undefined;

    const tick = () => {
      const left = secondsToNextCycle();
      setSecondsLeft((prev) => {
        // A virada é o salto para cima (1 → 300), não o zero: com o intervalo
        // de 1s o valor exato 0 pode simplesmente não ser amostrado.
        if (left > prev) {
          window.clearTimeout(settle);
          settle = window.setTimeout(() => dueRef.current?.(), SETTLE_MS);
        }
        return left;
      });
    };

    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(settle);
    };
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return {
    secondsLeft,
    /** "4:07" — pronto para exibir. */
    label: `${minutes}:${String(seconds).padStart(2, '0')}`,
    /** 0 → 1 conforme o ciclo avança; alimenta a barra de progresso. */
    progress: 1 - secondsLeft / CYCLE_SECONDS,
    cycleSeconds: CYCLE_SECONDS,
  };
};
