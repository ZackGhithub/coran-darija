import { useCallback } from 'react';
import type { Reciter } from '../types';
import { useAudio, type PlayOptions } from './useAudio';
import { gaplessSupported, useGapless } from './useGapless';

/**
 * Écoute des versets dans l'écran Récitation : un seul point d'entrée.
 *  - vitesse normale (1×) : lecture SANS COUPURE (versets préchargés et enchaînés, `useGapless`) ;
 *  - autre vitesse : lecture verset par verset qui conserve la hauteur de la voix (`useAudio`), avec de courtes coupures.
 * `play` doit être appelé directement depuis un appui (iOS).
 */
export function usePlayback(reciter: Reciter | undefined, rate: number) {
  const legacy = useAudio(reciter, 1, rate);
  const gapless = useGapless(reciter);
  const seamless = rate === 1 && gaplessSupported();

  const stopLegacy = legacy.stop;
  const stopGapless = gapless.stop;
  const stop = useCallback(() => {
    stopLegacy();
    stopGapless();
  }, [stopLegacy, stopGapless]);

  const playLegacy = legacy.playVerses;
  const playGapless = gapless.play;
  const play = useCallback(
    (surah: number, verses: number[], opts?: PlayOptions) => {
      if (seamless) {
        stopLegacy();
        playGapless(surah, verses, opts);
      } else {
        stopGapless();
        void playLegacy(surah, verses, opts);
      }
    },
    [seamless, stopLegacy, stopGapless, playLegacy, playGapless],
  );

  return {
    playing: gapless.playing ?? legacy.playing,
    info: gapless.info ?? legacy.info,
    error: gapless.error ?? legacy.error,
    seamless,
    play,
    stop,
  };
}
