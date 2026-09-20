import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechAlt {
  transcript: string;
}
interface SpeechResult {
  isFinal: boolean;
  0: SpeechAlt;
  length: number;
}
interface SpeechEvent {
  results: ArrayLike<SpeechResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Ctor = new () => Recognition;

const getCtor = (): Ctor | undefined => {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const MESSAGES: Record<string, string> = {
  'not-allowed': 'Micro refusé : autorisez le micro pour ce site dans les réglages du navigateur.',
  'service-not-allowed': 'La dictée est désactivée : activez Réglages > Général > Clavier > Activer la dictée (iPhone/iPad).',
  'audio-capture': 'Aucun micro détecté.',
  network: 'Connexion requise : la reconnaissance vocale passe par les serveurs du navigateur.',
  'language-not-supported': "L'arabe n'est pas disponible pour la reconnaissance vocale sur cet appareil.",
};
/** Erreurs après lesquelles relancer le micro ne servirait à rien. */
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported']);

/** Nombre max de relances automatiques par récitation (garde-fou contre une boucle infinie). */
const MAX_RESTARTS = 40;
/** Délai laissé au moteur pour s'arrêter proprement après « Terminer » avant de le forcer. */
const FORCE_ABORT_MS = 900;

/** Une app iOS installée sur l'écran d'accueil n'a souvent pas accès à la reconnaissance vocale (limite de WebKit). */
export const isStandaloneIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) && (navigator as unknown as { standalone?: boolean }).standalone === true;

/**
 * Reconnaissance vocale robuste.
 *
 * `listening` reflète l'INTENTION de l'utilisateur (il a appuyé sur « Réciter » et pas encore sur « Terminer »),
 * pas l'état interne du moteur. Les moteurs, surtout sur iOS, s'arrêtent d'eux-mêmes après un silence ou traitent
 * chaque phrase comme une session : on les relance sans perdre le texte déjà reconnu. Et « Terminer » répond
 * tout de suite, sans attendre un événement de fin qui n'arrive pas toujours.
 */
export function useSpeech(lang = 'ar-SA') {
  const rec = useRef<Recognition | null>(null);
  const want = useRef(false); // l'utilisateur veut écouter
  const base = useRef(''); // texte reconnu par les sessions précédentes du moteur
  const latest = useRef(''); // texte complet le plus récent
  const restarts = useRef(0);
  const timers = useRef<number[]>([]);
  const launchRef = useRef<() => void>(() => {});
  const [supported] = useState(() => !!getCtor());
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const giveUp = useCallback(() => {
    want.current = false;
    setListening(false);
    setInterim(false);
  }, []);

  const launch = useCallback(() => {
    const C = getCtor();
    if (!C) return giveUp();
    const r = new C();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      if (rec.current !== r) return;
      let text = '';
      let last: SpeechResult | undefined;
      for (let i = 0; i < e.results.length; i++) {
        text += ' ' + e.results[i][0].transcript;
        last = e.results[i];
      }
      const full = `${base.current} ${text}`.trim();
      latest.current = full;
      setTranscript(full);
      setInterim(last ? !last.isFinal : false);
    };
    r.onerror = (e) => {
      if (rec.current !== r) return;
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      setError(MESSAGES[e.error] ?? `Erreur de reconnaissance vocale (${e.error}).`);
      if (FATAL.has(e.error)) giveUp();
    };
    r.onend = () => {
      if (rec.current !== r) return;
      rec.current = null;
      setInterim(false);
      // Arrêt spontané du moteur (silence, limite iOS) alors que l'utilisateur écoute encore : on relance.
      if (want.current && restarts.current < MAX_RESTARTS) {
        restarts.current++;
        base.current = latest.current;
        later(() => want.current && launchRef.current(), 120);
      } else {
        giveUp();
      }
    };
    rec.current = r;
    try {
      r.start();
    } catch {
      rec.current = null;
      setError('Impossible de démarrer le micro.');
      giveUp();
    }
  }, [lang, giveUp]);
  launchRef.current = launch;

  const detach = (r: Recognition | null) => {
    if (!r) return;
    r.onresult = r.onerror = r.onend = null;
    try {
      r.abort();
    } catch {
      /* déjà arrêté */
    }
  };

  const start = useCallback(() => {
    if (!getCtor()) return;
    detach(rec.current); // l'ancien moteur signale sa fin APRÈS l'arrêt : on le détache
    rec.current = null;
    want.current = true;
    restarts.current = 0;
    base.current = '';
    latest.current = '';
    setError(null);
    setTranscript('');
    setInterim(false);
    setListening(true);
    launch();
  }, [launch]);

  const stop = useCallback(() => {
    want.current = false;
    setListening(false); // immédiat : le bouton ne reste jamais bloqué
    setInterim(false);
    const r = rec.current;
    if (!r) return;
    try {
      r.stop(); // laisse le moteur rendre les derniers mots reconnus
    } catch {
      /* déjà arrêté */
    }
    later(() => {
      if (rec.current === r) {
        detach(r);
        rec.current = null;
      }
    }, FORCE_ABORT_MS);
  }, []);

  useEffect(
    () => () => {
      want.current = false;
      timers.current.forEach(clearTimeout);
      detach(rec.current);
      rec.current = null;
    },
    [],
  );

  return { supported, listening, transcript, interim, error, start, stop };
}
