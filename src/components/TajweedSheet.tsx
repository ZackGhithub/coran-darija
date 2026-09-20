import { useEffect, useMemo, useRef, useState } from 'react';
import type { Reciter } from '../types';
import Icon from './Icon';
import { FAMILY_LABEL, RULE_BY_CODE, ruleColorVar, type TajweedRule } from '../content/tajweedRules';
import { TAJWEED_CODES } from '../lib/tajweedCodes';
import { contextOf, loadExamples, whyHere, wordPieces, type Examples, type Fragment } from '../lib/tajweed';
import { useSegmentPlayer } from '../hooks/useSegmentPlayer';

/** Ce que la fiche explique : un mot touché dans le texte, ou une règle choisie dans la liste. */
export type SheetTarget =
  | { kind: 'word'; surah: number; verse: number; verseText: string; wordIdx: number; wordCount: number; wordStart: number; wordEnd: number; frags: Fragment[] }
  | { kind: 'rule'; code: string };

interface Props {
  target: SheetTarget | null;
  onClose: () => void;
  reciter: Reciter; // choisi par l'utilisateur
  fallback: Reciter; // récitateur aux horodatages exacts, si le premier n'en a pas
  surahNames: string[]; // nom français de chaque sourate (indice n-1)
  /** Appelé avant chaque lecture : l'écran qui ouvre la fiche coupe son propre audio et le micro. */
  onBeforePlay?: () => void;
}

const shortName = (r: TajweedRule) => r.fr.replace(/\s*\(.*\)\s*$/, '');

export default function TajweedSheet({ target, onClose, reciter, fallback, surahNames, onBeforePlay }: Props) {
  if (!target) return null;
  return <Sheet target={target} onClose={onClose} reciter={reciter} fallback={fallback} surahNames={surahNames} onBeforePlay={onBeforePlay} />;
}

function Sheet({ target, onClose, reciter, fallback, surahNames, onBeforePlay }: Props & { target: SheetTarget }) {
  // Les horodatages exacts de mots n'existent que pour certains récitateurs : sinon on écoute le récitateur de référence.
  const rec = reciter.qcId ? reciter : fallback;
  const player = useSegmentPlayer(rec);
  const [slow, setSlow] = useState(false);
  const [active, setActive] = useState(0);
  const [examples, setExamples] = useState<Examples | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeFn = useRef(onClose); // le parent recrée onClose à chaque rendu : on garde la dernière version sans relancer l'effet
  closeFn.current = onClose;
  const rate = slow ? 0.5 : 1;

  // Un élément par fragment coloré du mot (mode « mot »)
  const items = useMemo(() => {
    if (target.kind !== 'word') return [];
    return target.frags
      .filter((f) => f.end > target.wordStart && f.start < target.wordEnd)
      .map((f) => ({ frag: f, rule: RULE_BY_CODE[TAJWEED_CODES[f.rule]], ctx: contextOf(target.verseText, f) }));
  }, [target]);
  const pieces = useMemo(() => (target.kind === 'word' ? wordPieces(target.verseText, target.wordStart, target.wordEnd, target.frags) : []), [target]);

  const current = target.kind === 'word' ? items[Math.min(active, items.length - 1)] : null;
  const rule = target.kind === 'rule' ? RULE_BY_CODE[target.code] : current?.rule;

  useEffect(() => {
    let alive = true;
    loadExamples().then((e) => alive && setExamples(e)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Accessibilité : focus dans la fiche, Échap pour fermer, page derrière figée, focus rendu à la fermeture
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeFn.current();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      before?.focus?.();
    };
  }, []);

  if (!rule) return null;
  const why = current ? whyHere(current.ctx) : [];
  const list = examples?.[rule.code] ?? [];
  const playing = (key: string) => player.state.key === key && player.state.status === 'playing';
  const loading = (key: string) => player.state.key === key && player.state.status === 'loading';
  const failed = player.state.status === 'error';

  const playSegment = (key: string, surah: number, verse: number, word: number | null, wordCount?: number) => {
    onBeforePlay?.();
    if (player.state.key === key && player.state.status !== 'idle') return player.stop();
    player.play({ key, surah, verse, word, wordCount, rate });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 id="sheet-title">
            <Icon name="tajweed" /> Tajwid
          </h2>
          <button ref={closeRef} className="sheet-close" onClick={onClose} aria-label="Fermer la fiche">
            <Icon name="close" size="1.3em" />
          </button>
        </header>

        <div className="sheet-body">
          {target.kind === 'word' && (
            <>
              <div className="sheet-word" lang="ar" dir="rtl">
                {pieces.map((p, i) => {
                  const focus = !!current && p.rule >= 0 && p.rule === current.frag.rule && p.start >= current.frag.start && p.start < current.frag.end;
                  return (
                    <span key={i} className={`${p.rule >= 0 ? `tj tj-${TAJWEED_CODES[p.rule].replace(/_/g, '-')}` : ''} ${focus ? 'tj-focus' : ''}`.trim() || undefined}>
                      {p.text}
                    </span>
                  );
                })}
              </div>
              {items.length > 1 && (
                <div className="chips sheet-tabs" role="tablist" aria-label="Règles de ce mot">
                  {items.map((it, i) => (
                    <button key={i} role="tab" aria-selected={i === active} className={`chip ${i === active ? 'on' : ''}`} onClick={() => setActive(i)}>
                      <span className="tj-dot" style={{ background: ruleColorVar(it.rule.code) }} aria-hidden="true" />
                      {shortName(it.rule)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="sheet-rule-title">
            <span className="tj-dot big" style={{ background: ruleColorVar(rule.code) }} aria-hidden="true" />
            <div>
              <h3>{rule.fr}</h3>
              <p className="sheet-ar" lang="ar" dir="rtl">{rule.ar}</p>
              <p className="muted">{FAMILY_LABEL[rule.family]}{rule.timing ? ` · ${rule.timing}` : ''}</p>
            </div>
          </div>
          <p className="sheet-summary">{rule.summary}</p>

          {target.kind === 'word' && why.length > 0 && (
            <div className="sheet-block sheet-why">
              <h4><Icon name="idea" /> Pourquoi ici ?</h4>
              {why.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}

          <div className="sheet-block">
            <h4><Icon name="book" /> La règle</h4>
            <p>{rule.when}</p>
          </div>

          <div className="sheet-block">
            <h4><Icon name="mic" /> Comment la prononcer</h4>
            <ol className="sheet-steps">
              {rule.how.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ol>
          </div>

          {rule.mistakes.length > 0 && (
            <div className="sheet-block">
              <h4><Icon name="warning" /> Erreurs à éviter</h4>
              <ul className="sheet-list">
                {rule.mistakes.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
              {rule.darija && <p className="sheet-darija"><Icon name="info" size="1em" /> {rule.darija}</p>}
            </div>
          )}

          <div className="sheet-block">
            <h4><Icon name="sound" /> Écouter</h4>
            {target.kind === 'word' && (
              <div className="sheet-audio">
                <button className="btn btn-primary" onClick={() => playSegment('word', target.surah, target.verse, target.wordIdx, target.wordCount)}>
                  {playing('word') || loading('word') ? <Icon name="stop" filled /> : <Icon name="play" filled />} Écouter ce mot
                </button>
                <button className="btn" onClick={() => playSegment('verse', target.surah, target.verse, null)}>
                  {playing('verse') || loading('verse') ? <Icon name="stop" filled /> : <Icon name="play" filled />} Le verset
                </button>
              </div>
            )}
            <div className="sheet-audio">
              <button className={`chip ${slow ? 'on' : ''}`} aria-pressed={slow} onClick={() => setSlow((s) => !s)}>
                <Icon name="slow" /> Ralenti (0,5×)
              </button>
              <span className="muted sheet-rec">Récitateur : {rec.name}{rec.id !== reciter.id ? ' (horodatage exact)' : ''}</span>
            </div>
            {failed && <p className="voice-error">Impossible de lire l'audio. Vérifiez la connexion.</p>}

            {list.length > 0 && (
              <>
                <p className="sheet-examples-title">{target.kind === 'word' ? 'Autres exemples, dans la bouche du récitant' : 'Exemples, dans la bouche du récitant'}</p>
                <ul className="sheet-examples">
                  {list.map((ex, i) => {
                    const key = `ex-${rule.code}-${i}`;
                    return (
                      <li key={key}>
                        <button className="ex-play" onClick={() => playSegment(key, ex.s, ex.v, ex.w)} aria-label={`Écouter l'exemple : ${surahNames[ex.s - 1]}, verset ${ex.v}`}>
                          <Icon name={playing(key) || loading(key) ? 'stop' : 'play'} filled />
                        </button>
                        <span className="ex-word" lang="ar" dir="rtl">
                          {ex.t.map(([text, r], k) => (
                            <span key={k} className={r >= 0 ? `tj tj-${TAJWEED_CODES[r].replace(/_/g, '-')}` : undefined}>
                              {text}
                            </span>
                          ))}
                        </span>
                        <span className="muted ex-ref">{surahNames[ex.s - 1]} {ex.s}:{ex.v}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <p className="sheet-note">
            <Icon name="info" size="1em" /> Explications d&apos;aide à l&apos;apprentissage (lecture de Hafs ʿan ʿĀṣim). Elles ne remplacent pas un enseignant : faites-les valider
            par une personne qualifiée.
          </p>
        </div>
      </section>
    </div>
  );
}
