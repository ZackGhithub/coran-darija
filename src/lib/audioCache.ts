/**
 * Garde en mémoire les fichiers audio déjà lus (un verset pèse 50 Ko à 2 Mo) : les répétitions du Hifz redémarrent
 * instantanément, sans nouvelle requête réseau, et une connexion qui faiblit ne coupe plus la boucle.
 * Les fichiers de everyayah.com autorisent la lecture depuis le navigateur (CORS), sinon on lit directement l'adresse.
 */
const MAX_ENTRIES = 40;
const blobs = new Map<string, Promise<string>>();

export function audioBlobUrl(url: string): Promise<string> {
  let p = blobs.get(url);
  if (p) {
    // ré-insère pour garder l'ordre « récemment utilisé »
    blobs.delete(url);
    blobs.set(url, p);
    return p;
  }
  p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.blob();
    })
    .then((b) => URL.createObjectURL(b));
  p.catch(() => blobs.delete(url));
  blobs.set(url, p);
  while (blobs.size > MAX_ENTRIES) {
    const oldest = blobs.keys().next().value as string;
    const old = blobs.get(oldest);
    blobs.delete(oldest);
    old?.then((u) => URL.revokeObjectURL(u)).catch(() => {});
  }
  return p;
}

/** Son muet de 0 s : lu lors d'un appui pour que iOS autorise ensuite la lecture sans nouvel appui. */
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

let shared: HTMLAudioElement | null = null;

/**
 * Un seul élément audio pour tout le module de mémorisation. Sur iOS, seul un élément déjà lancé par un appui de
 * l'utilisateur peut être relancé ensuite par le code : le partager permet de débloquer le son depuis n'importe quel
 * bouton (ex : « Répéter » sur un verset), puis de lancer la session après le changement d'écran.
 */
export function sharedAudio(): HTMLAudioElement {
  if (!shared) {
    shared = new Audio();
    shared.preload = 'auto';
  }
  return shared;
}

/** À appeler directement depuis un appui : débloque le son pour la suite. */
export function unlockAudio() {
  const a = sharedAudio();
  if (a.paused) {
    a.src = SILENT;
    a.play().catch(() => {});
  }
}

/** Règle la vitesse de lecture en gardant la hauteur de la voix (sinon le récitateur devient grave et déformé). */
export function applyRate(a: HTMLAudioElement, rate: number) {
  a.defaultPlaybackRate = rate;
  a.playbackRate = rate;
  const x = a as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean };
  x.preservesPitch = true;
  x.webkitPreservesPitch = true;
}

/** Charge à l'avance (sans attendre le résultat ni signaler d'erreur). */
export function prefetchAudio(url: string) {
  audioBlobUrl(url).catch(() => {});
}
