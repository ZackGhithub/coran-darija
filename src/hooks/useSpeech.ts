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

/** Une app iOS installée sur l'écran d'accueil n'a souvent pas accès à la reconnaissance vocale (limite de WebKit). */
export const isStandaloneIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) && (navigator as unknown as { standalone?: boolean }).standalone === true;

export function useSpeech(lang = 'ar-SA') {
  const rec = useRef<Recognition | null>(null);
  const [supported] = useState(() => !!getCtor());
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  const start = useCallback(() => {
    const C = getCtor();
    if (!C) return;
    // L'ancien enregistrement signale sa fin APRÈS l'arrêt : on le détache pour qu'il ne coupe pas le nouveau.
    const old = rec.current;
    if (old) {
      old.onresult = old.onerror = old.onend = null;
      old.abort();
    }
    setError(null);
    setTranscript('');
    setInterim(false);
    const r = new C();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let text = '';
      let last: SpeechResult | undefined;
      for (let i = 0; i < e.results.length; i++) {
        text += ' ' + e.results[i][0].transcript;
        last = e.results[i];
      }
      setTranscript(text.trim());
      setInterim(last ? !last.isFinal : false);
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      setError(MESSAGES[e.error] ?? `Erreur de reconnaissance vocale (${e.error}).`);
    };
    r.onend = () => {
      if (rec.current !== r) return;
      setListening(false);
      setInterim(false);
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError('Impossible de démarrer le micro.');
    }
  }, [lang]);

  useEffect(() => () => rec.current?.abort(), []);

  return { supported, listening, transcript, interim, error, start, stop };
}
