import { useCallback, useEffect, useRef, useState } from 'react';
import type { Reciter } from '../types';
import { ayahUrl, type PlayInfo, type PlayOptions, type Playing } from './useAudio';
import { stepAt } from '../lib/hifzPlan';

/**
 * Lecture SANS COUPURE d'une suite de versets.
 *
 * Avec un élément <audio> par verset, chaque nouveau fichier doit être chargé avant de démarrer : on entend une
 * coupure entre deux versets. Ici les versets sont téléchargés et décodés À L'AVANCE, puis programmés bout à bout
 * dans Web Audio (`start(t)` à l'instant exact où le précédent finit) : l'enchaînement est exact à l'échantillon près.
 * Les fichiers des récitateurs sont coupés au plus juste (quelques ms de silence), la récitation reste donc continue.
 *
 * Limite : Web Audio ne change pas la vitesse sans changer la hauteur de la voix ; ce lecteur sert donc à vitesse
 * normale (le lecteur `useAudio` garde la hauteur pour les autres vitesses).
 */

type AudioCtor = typeof AudioContext;
const Ctor = (): AudioCtor | undefined => (typeof window === 'undefined' ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext);
export const gaplessSupported = () => !!Ctor();

/** Temps d'audio programmé d'avance (s) : assez pour que l'enchaînement tienne si l'écran s'éteint ou le réseau hoquette. */
const AHEAD_S = 25;
const MAX_CACHED = 14;

let ctx: AudioContext | null = null;
let keepAlive: HTMLAudioElement | null = null;

/** Un fichier son muet d'une seconde, généré ici (aucune ressource externe). */
function silentWavUrl(): string {
  const rate = 8000;
  const n = rate;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/**
 * À appeler directement depuis un appui (iOS). Web Audio est coupé par l'interrupteur « silencieux » de l'iPhone, pas un
 * élément <audio> : on passe la session audio en « lecture » et on fait tourner un son muet pour que la voix reste audible.
 */
function unlock(): AudioContext | null {
  const C = Ctor();
  if (!C) return null;
  if (!ctx) ctx = new C();
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  try {
    if (!keepAlive) {
      keepAlive = new Audio(silentWavUrl());
      keepAlive.loop = true;
    }
    keepAlive.play().catch(() => {});
  } catch {
    /* sans importance : la lecture fonctionne, seul le mode silencieux de l'iPhone peut la couper */
  }
  return ctx;
}

const buffers = new Map<string, Promise<AudioBuffer>>();
function loadBuffer(c: AudioContext, url: string): Promise<AudioBuffer> {
  let p = buffers.get(url);
  if (p) {
    buffers.delete(url);
    buffers.set(url, p);
    return p;
  }
  p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((ab) => new Promise<AudioBuffer>((res, rej) => c.decodeAudioData(ab, res, rej)));
  p.catch(() => buffers.delete(url));
  buffers.set(url, p);
  while (buffers.size > MAX_CACHED) buffers.delete(buffers.keys().next().value as string);
  return p;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Slot {
  verse: number;
  start: number;
  end: number;
  info: PlayInfo;
  src: AudioBufferSourceNode;
}

export function useGapless(reciter: Reciter | undefined) {
  const run = useRef(0);
  const slots = useRef<Slot[]>([]);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [info, setInfo] = useState<PlayInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    run.current++;
    slots.current.forEach((s) => {
      try {
        s.src.stop();
        s.src.disconnect();
      } catch {
        /* déjà terminé */
      }
    });
    slots.current = [];
    keepAlive?.pause();
    setPlaying(null);
    setInfo(null);
  }, []);

  useEffect(() => stop, [stop]);

  /** À appeler directement depuis un appui (le son est débloqué avant toute attente). */
  const play = useCallback(
    (surah: number, verses: number[], opts?: PlayOptions) => {
      if (!reciter || !verses.length) return;
      stop();
      setError(null);
      const c = unlock();
      if (!c) return;
      const my = ++run.current;
      const alive = () => run.current === my;
      const plan = { count: verses.length, verseRepeat: Math.max(1, opts?.repeat ?? 1), groupRepeat: opts?.passages ?? 1 };
      const urlOf = (idx: number) => {
        const s = stepAt(plan, idx);
        return s ? { url: ayahUrl(reciter.folder, surah, verses[s.verseIndex]), step: s } : null;
      };

      // Retour immédiat à l'appui (le téléchargement du premier verset peut prendre un instant)
      setPlaying({ surah, verse: verses[0] });
      setInfo({ verseRep: 1, verseRepeat: plan.verseRepeat, group: 1, passages: plan.groupRepeat, count: plan.count });

      let last: Slot | null = null;
      /** Met à jour le verset affiché d'après l'instant réellement joué. */
      const refresh = () => {
        const now = c.currentTime;
        slots.current = slots.current.filter((s) => s.end > now - 1);
        const cur = slots.current.find((s) => s.start <= now && now < s.end);
        if (cur && cur !== last) {
          if (!last || last.verse !== cur.verse) setPlaying({ surah, verse: cur.verse });
          setInfo(cur.info);
          last = cur;
        }
      };

      (async () => {
        try {
          let t = 0;
          let idx = 0;
          for (;;) {
            const cur = urlOf(idx);
            if (!cur) break;
            const buf = await loadBuffer(c, cur.url);
            if (!alive()) return;
            // Prépare les deux versets suivants pendant que celui-ci se joue
            for (const k of [1, 2]) {
              const nx = urlOf(idx + k);
              if (nx) loadBuffer(c, nx.url).catch(() => {});
            }
            // Le réseau a pris du retard : on repart tout de suite (seul cas où une coupure est possible)
            if (t < c.currentTime + 0.03) t = c.currentTime + 0.05;
            const src = c.createBufferSource();
            src.buffer = buf;
            src.connect(c.destination);
            src.start(t);
            const info: PlayInfo = { verseRep: cur.step.verseRep, verseRepeat: plan.verseRepeat, group: cur.step.group, passages: plan.groupRepeat, count: plan.count };
            slots.current.push({ verse: verses[cur.step.verseIndex], start: t, end: t + buf.duration, info, src });
            t += buf.duration;
            idx++;
            // Ne programme pas plus loin que nécessaire (boucle sans fin, sourate très longue)
            while (alive() && t - c.currentTime > AHEAD_S) {
              refresh();
              await sleep(150);
            }
            refresh();
          }
          while (alive() && c.currentTime < t) {
            refresh();
            await sleep(100);
          }
          if (alive()) stop();
        } catch {
          if (alive()) {
            stop();
            setError('Audio indisponible : vérifiez votre connexion ou choisissez un autre récitateur.');
          }
        }
      })();
    },
    [reciter, stop],
  );

  return { playing, info, error, play, stop };
}
