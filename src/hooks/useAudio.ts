import { useCallback, useEffect, useRef, useState } from 'react';
import type { Reciter } from '../types';

export const ayahUrl = (folder: string, surah: number, verse: number) =>
  `https://everyayah.com/data/${folder}/${String(surah).padStart(3, '0')}${String(verse).padStart(3, '0')}.mp3`;

export interface Playing {
  surah: number;
  verse: number;
}

/** Ce qu'on demande de lire : chaque verset `repeat` fois, puis le passage entier `passages` fois (0 = en boucle sans fin). */
export interface PlayOptions {
  repeat?: number;
  passages?: number;
}

/** Où en est la lecture (pour l'afficher). */
export interface PlayInfo {
  verseRep: number; // lecture n° du verset en cours
  verseRepeat: number;
  group: number; // passage n°
  passages: number; // 0 = sans fin
  count: number; // nombre de versets du passage
}

/**
 * Lecteur audio « élément par verset » : un verset (avec répétition) ou une suite, avec le récitateur choisi, à toute
 * vitesse (la hauteur de la voix est conservée). Chaque verset est un nouveau fichier : de courtes coupures peuvent
 * s'entendre entre deux versets. Pour l'enchaînement sans coupure, voir `useGapless` (vitesse normale).
 * `repeat` = nombre de lectures de chaque verset par défaut.
 */
export function useAudio(reciter: Reciter | undefined, repeat: number, rate = 1) {
  const el = useRef<HTMLAudioElement | null>(null);
  const run = useRef(0); // invalide les lectures obsolètes quand on change de verset
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [info, setInfo] = useState<PlayInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    run.current++;
    el.current?.pause();
    el.current = null;
    setPlaying(null);
    setInfo(null);
  }, []);

  useEffect(() => stop, [stop]);

  const playVerses = useCallback(
    async (surah: number, verses: number[], opts?: PlayOptions) => {
      if (!reciter) return;
      stop();
      setError(null);
      const my = ++run.current;
      const verseRepeat = Math.max(1, opts?.repeat ?? repeat);
      const passages = opts?.passages ?? 1;
      for (let group = 1; passages === 0 || group <= passages; group++) {
        for (const verse of verses) {
          for (let r = 0; r < verseRepeat; r++) {
            if (run.current !== my) return;
            setPlaying({ surah, verse });
            setInfo({ verseRep: r + 1, verseRepeat, group, passages, count: verses.length });
            const audio = new Audio(ayahUrl(reciter.folder, surah, verse));
            audio.defaultPlaybackRate = rate;
            audio.playbackRate = rate;
            (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
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
                setInfo(null);
              }
              return;
            }
          }
        }
      }
      if (run.current === my) {
        setPlaying(null);
        setInfo(null);
      }
    },
    [reciter, repeat, rate, stop],
  );

  return { playing, info, error, playVerses, stop };
}
