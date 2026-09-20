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

/** Charge à l'avance (sans attendre le résultat ni signaler d'erreur). */
export function prefetchAudio(url: string) {
  audioBlobUrl(url).catch(() => {});
}
