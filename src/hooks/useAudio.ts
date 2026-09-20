import { useCallback, useEffect, useRef, useState } from 'react';
import type { Reciter } from '../types';

export const ayahUrl = (folder: string, surah: number, verse: number) =>
  `https://everyayah.com/data/${folder}/${String(surah).padStart(3, '0')}${String(verse).padStart(3, '0')}.mp3`;

export interface Playing {
  surah: number;
  verse: number;
}

/**
 * Lecteur audio : un verset (avec répétition) ou toute la sourate à la suite, avec le récitateur choisi.
 * `repeat` = nombre de lectures de chaque verset (pour mémoriser).
 */
export function useAudio(reciter: Reciter | undefined, repeat: number) {
  const el = useRef<HTMLAudioElement | null>(null);
  const run = useRef(0); // invalide les lectures obsolètes quand on change de verset
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    run.current++;
    el.current?.pause();
    el.current = null;
    setPlaying(null);
  }, []);

  useEffect(() => stop, [stop]);

  const playVerses = useCallback(
    async (surah: number, verses: number[]) => {
      if (!reciter) return;
      stop();
      setError(null);
      const my = ++run.current;
      for (const verse of verses) {
        for (let r = 0; r < repeat; r++) {
          if (run.current !== my) return;
          setPlaying({ surah, verse });
          const audio = new Audio(ayahUrl(reciter.folder, surah, verse));
          el.current = audio;
          try {
            await new Promise<void>((resolve, reject) => {
              audio.onended = () => resolve();
              audio.onerror = () => reject(new Error('audio'));
              audio.play().catch(reject);
            });
          } catch {
            if (run.current === my) {
              setError('Audio indisponible : vérifiez votre connexion ou choisissez un autre récitateur.');
              setPlaying(null);
            }
            return;
          }
        }
      }
      if (run.current === my) setPlaying(null);
    },
    [reciter, repeat, stop],
  );

  return { playing, error, playVerses, stop };
}
