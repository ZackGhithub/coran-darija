import { memo, useEffect, useMemo, useState } from 'react';
import type { Enriched, Meta, Verse } from '../types';
import { getEnriched, loadSurah } from '../lib/data';
import { splitVerse, tokenizeVerse } from '../lib/arabic';
import { loadTimings, translitToWord, translitTokens, type VerseTimings } from '../lib/timing';
import { totalSteps, stepsPerGroup, type PauseMode } from '../lib/hifzPlan';
import { useHifz, type HifzConfig } from '../hooks/useHifz';
import { usePersisted } from '../lib/storage';

export interface HifzSettings {
  verseRepeat: number;
  groupRepeat: number; // 0 = sans fin
  pause: PauseMode;
  showTranslit: boolean;
}

export const DEFAULT_HIFZ: HifzSettings = { verseRepeat: 3, groupRepeat: 1, pause: 'verse', showTranslit: true };
export const TEMPOS = [0.5, 0.6, 0.75, 0.9, 1, 1.15, 1.25] as const;

const PAUSES: { id: PauseMode; label: string; hint: string }[] = [
  { id: '0', label: 'Aucune', hint: 'Enchaîne directement' },
  { id: '1', label: '1 s', hint: '' },
  { id: '2', label: '2 s', hint: '' },
  { id: '3', label: '3 s', hint: '' },
  { id: 'verse', label: 'Durée du verset', hint: 'Le temps de répéter à voix haute après le récitateur' },
];

interface Props {
  meta: Meta;
  reciterId: string;
  onReciter: (id: string) => void;
  tempo: number;
  onTempo: (t: number) => void;
  settings: HifzSettings;
  onSettings: (s: HifzSettings) => void;
  /** Sélection venue de l'écran Récitation (bouton « Mémoriser ») */
  preset: { surah: number; from: number; to: number; nonce: number } | null;
}

interface Sel {
  surah: number;
  from: number;
  to: number;
}

const fmtTempo = (t: number) => `${String(t).replace('.', ',')}×`;

export default function Hifz(p: Props) {
  const { meta } = p;
  const [sel, setSel] = usePersisted<Sel>('hifzSel', { surah: 1, from: 1, to: 3 });
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [timings, setTimings] = useState<VerseTimings | null>(null);
  const [loadError, setLoadError] = useState(false);

  const reciter = meta.reciters.find((r) => r.id === p.reciterId) ?? meta.reciters[0];
  const surah = meta.surahs[sel.surah - 1];
  const enriched = useMemo(() => getEnriched(sel.surah), [sel.surah]);

  useEffect(() => {
    if (p.preset) setSel({ surah: p.preset.surah, from: p.preset.from, to: p.preset.to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.preset?.nonce]);

  useEffect(() => {
    let alive = true;
    setVerses(null);
    setLoadError(false);
    loadSurah(sel.surah)
      .then((v) => alive && setVerses(v))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, [sel.surah]);

  useEffect(() => {
    let alive = true;
    setTimings(null);
    if (reciter.qcId) loadTimings(reciter.id, sel.surah).then((t) => alive && setTimings(t));
    return () => {
      alive = false;
    };
  }, [reciter.id, reciter.qcId, sel.surah]);

  // Versets du groupe (bornés à la sourate, ordre croissant)
  const from = Math.min(Math.max(1, sel.from), surah.verses);
  const to = Math.min(Math.max(from, sel.to), surah.verses);
  const group = useMemo(
    () => (verses ?? []).filter((v) => v.n >= from && v.n <= to).map((v) => ({ verse: v, n: v.n, words: tokenizeVerse(v.ar) })),
    [verses, from, to],
  );
  const hifzVerses = useMemo(() => group.map(({ n, words }) => ({ n, words })), [group]);

  const cfg: HifzConfig = { verseRepeat: p.settings.verseRepeat, groupRepeat: p.settings.groupRepeat, pause: p.settings.pause, rate: p.tempo };
  const player = useHifz(reciter, sel.surah, hifzVerses, cfg, timings);
  const { state } = player;
  const busy = state.status !== 'idle' && state.status !== 'done' && state.status !== 'error';

  // Si on change de sourate, de plage ou de récitateur, on arrête la lecture en cours
  useEffect(() => {
    player.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.surah, from, to, reciter.id]);

  // La page suit le verset lu
  useEffect(() => {
    if (state.verse != null && (state.status === 'playing' || state.status === 'loading')) {
      document.getElementById(`h-${state.verse}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [state.verse, state.status]);

  const verseOptions = Array.from({ length: surah.verses }, (_, i) => i + 1);
  const setSettings = (patch: Partial<HifzSettings>) => p.onSettings({ ...p.settings, ...patch });
  const plan = { count: group.length, verseRepeat: p.settings.verseRepeat, groupRepeat: p.settings.groupRepeat };
  const total = totalSteps(plan);
  const perGroup = stepsPerGroup(plan);
  const synced = !!reciter.qcId;

  return (
    <section className={`tab-content fade-in ${busy || state.status === 'done' ? 'has-voice-bar' : ''}`}>
      <div className="guide-card hifz-card">
        <h2 className="guide-title">🔁 Mémorisation (Hifz)</h2>
        <p className="muted">
          Choisissez un verset ou un groupe de versets : le récitateur les répète autant de fois que vous voulez, à la vitesse que vous voulez,
          et le texte est surligné au rythme de la voix.
        </p>

        <div className="hifz-grid">
          <label className="range-field">
            <span>Sourate</span>
            <select className="surah-select" value={sel.surah} onChange={(e) => setSel({ surah: Number(e.target.value), from: 1, to: Math.min(3, meta.surahs[Number(e.target.value) - 1].verses) })} aria-label="Sourate à mémoriser">
              {meta.surahs.map((s) => (
                <option key={s.n} value={s.n}>{s.n}. {s.fr}</option>
              ))}
            </select>
          </label>
          <label className="range-field">
            <span>Du verset</span>
            <select className="surah-select" value={from} onChange={(e) => { const f = Number(e.target.value); setSel({ ...sel, from: f, to: Math.max(to, f) }); }} aria-label="Premier verset">
              {verseOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="range-field">
            <span>Au verset</span>
            <select className="surah-select" value={to} onChange={(e) => setSel({ ...sel, from: Math.min(from, Number(e.target.value)), to: Number(e.target.value) })} aria-label="Dernier verset">
              {verseOptions.filter((n) => n >= from).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <div className="hifz-quick">
          <button className="btn-action-compact" onClick={() => setSel({ ...sel, to: from })}>Un seul verset</button>
          <button className="btn-action-compact" onClick={() => setSel({ ...sel, to: Math.min(surah.verses, from + 2) })}>3 versets</button>
          <button className="btn-action-compact" onClick={() => setSel({ ...sel, to: Math.min(surah.verses, from + 4) })}>5 versets</button>
          <button className="btn-action-compact" onClick={() => setSel({ surah: sel.surah, from: 1, to: surah.verses })}>Toute la sourate</button>
        </div>

        <h3 className="hifz-h">Répétition</h3>
        <div className="hifz-grid">
          <Stepper label="Chaque verset répété" value={p.settings.verseRepeat} min={1} max={99} suffix="×" onChange={(v) => setSettings({ verseRepeat: v })} />
          <Stepper label="Le groupe répété" value={p.settings.groupRepeat} min={1} max={99} suffix="×" infinite onChange={(v) => setSettings({ groupRepeat: v })} />
        </div>

        <h3 className="hifz-h">Pause entre les lectures</h3>
        <div className="chips" role="radiogroup" aria-label="Pause entre les lectures">
          {PAUSES.map((o) => (
            <button key={o.id} role="radio" aria-checked={p.settings.pause === o.id} className={`chip ${p.settings.pause === o.id ? 'on' : ''}`} onClick={() => setSettings({ pause: o.id })} title={o.hint || undefined}>
              {o.label}
            </button>
          ))}
        </div>
        {p.settings.pause === 'verse' && <p className="hifz-note">Après chaque lecture, silence de la durée du verset : c&apos;est à vous de le répéter.</p>}

        <h3 className="hifz-h">Tempo de la récitation</h3>
        <div className="chips" role="radiogroup" aria-label="Vitesse de la récitation">
          {TEMPOS.map((t) => (
            <button key={t} role="radio" aria-checked={p.tempo === t} className={`chip ${p.tempo === t ? 'on' : ''}`} onClick={() => p.onTempo(t)}>
              {fmtTempo(t)}
            </button>
          ))}
        </div>
        <p className="hifz-note">Ralentir garde la voix naturelle (la hauteur ne change pas). Commencez lentement, accélérez quand le verset est acquis.</p>

        <h3 className="hifz-h">Récitateur</h3>
        <select className="surah-select reciter-select" value={reciter.id} onChange={(e) => p.onReciter(e.target.value)} aria-label="Choisir le récitateur">
          {meta.reciters.map((r) => (
            <option key={r.id} value={r.id}>{r.qcId ? '● ' : '○ '}{r.name}</option>
          ))}
        </select>
        <p className="hifz-note">
          {synced
            ? '● Surlignage synchronisé sur la voix (horodatages réels de chaque mot).'
            : '○ Surlignage estimé : réparti selon la longueur des mots, donc approximatif. Choisissez un récitateur ● pour une synchronisation exacte.'}
        </p>

        <label className="hifz-check">
          <input type="checkbox" checked={p.settings.showTranslit} onChange={(e) => setSettings({ showTranslit: e.target.checked })} />
          Afficher la translittération quand elle existe
        </label>
      </div>

      {loadError && <div className="notice notice-error" role="alert">Impossible de charger la sourate. Vérifiez votre connexion.</div>}
      {!verses && !loadError && <div className="loading">Chargement…</div>}

      {group.map(({ verse, n, words }) => (
        <HifzVerse
          key={n}
          verse={verse}
          wordCount={words.length}
          enriched={p.settings.showTranslit ? enriched?.get(n) : undefined}
          active={state.verse === n && busy}
          activeWord={state.verse === n && busy ? state.word : -1}
          gap={state.verse === n && state.status === 'gap'}
        />
      ))}

      <div className="voice-bar hifz-bar" role="status" aria-live="polite">
        <div className="voice-bar-row">
          <span className="voice-bar-state">
            {state.status === 'idle' && `${group.length} verset${group.length > 1 ? 's' : ''} prêt${group.length > 1 ? 's' : ''}`}
            {state.status === 'loading' && 'Chargement…'}
            {state.status === 'playing' && <><span className="rec-dot play" aria-hidden="true" />Lecture</>}
            {state.status === 'gap' && '🗣️ À vous de répéter'}
            {state.status === 'paused' && '⏸ En pause'}
            {state.status === 'done' && '✓ Terminé'}
            {state.status === 'error' && '⚠ Erreur'}
          </span>
          {state.verse != null && (
            <span className="voice-bar-where">
              Verset {state.verse} · lecture {state.verseRep}/{p.settings.verseRepeat}
              {p.settings.groupRepeat === 0 ? ' · boucle sans fin' : p.settings.groupRepeat > 1 ? ` · passage ${state.groupRep}/${p.settings.groupRepeat}` : ''}
            </span>
          )}
          <span className="muted">{p.tempo !== 1 ? fmtTempo(p.tempo) : ''}</span>
          {total !== null && state.status === 'idle' && <span className="muted">{total} lectures au total</span>}
          {total === null && state.status === 'idle' && <span className="muted">{perGroup} lectures par passage, sans fin</span>}
        </div>

        <div className="progress-track small">
          <div className="progress-fill" style={{ width: `${state.status === 'gap' ? (state.gapTotalMs ? (1 - state.gapLeftMs / state.gapTotalMs) * 100 : 0) : state.progress * 100}%` }} />
        </div>
        {state.status === 'gap' && <div className="muted">Reprise dans {(state.gapLeftMs / 1000).toFixed(1)} s</div>}
        {state.status === 'error' && state.error && <div className="voice-error">{state.error}</div>}
        {busy && !state.synced && state.word >= 0 && !synced && <div className="voice-hint">Surlignage estimé (récitateur sans horodatage exact).</div>}

        <div className="transport">
          <button className="btn" onClick={player.prev} disabled={!busy} aria-label="Verset précédent">⏮</button>
          {state.status === 'playing' || state.status === 'gap' || state.status === 'loading' ? (
            <button className="btn btn-primary transport-main" onClick={player.pause}>⏸ Pause</button>
          ) : state.status === 'paused' ? (
            <button className="btn btn-primary transport-main" onClick={player.resume}>▶ Reprendre</button>
          ) : (
            <button className="btn btn-primary transport-main" onClick={player.play} disabled={!group.length}>▶ Lecture</button>
          )}
          <button className="btn" onClick={player.next} disabled={!busy} aria-label="Verset suivant">⏭</button>
          <button className="btn" onClick={player.stop} disabled={!busy && state.status !== 'done'} aria-label="Arrêter">⏹</button>
        </div>
      </div>
    </section>
  );
}

function Stepper(p: { label: string; value: number; min: number; max: number; suffix: string; infinite?: boolean; onChange: (v: number) => void }) {
  const inf = p.infinite && p.value === 0;
  return (
    <div className="stepper">
      <span className="stepper-label">{p.label}</span>
      <div className="stepper-row">
        <button className="btn btn-icon" aria-label={`Diminuer : ${p.label}`} disabled={inf} onClick={() => p.onChange(Math.max(p.min, p.value - 1))}>−</button>
        <output className="stepper-value">{inf ? '∞' : `${p.value}${p.suffix}`}</output>
        <button className="btn btn-icon" aria-label={`Augmenter : ${p.label}`} disabled={inf} onClick={() => p.onChange(Math.min(p.max, p.value + 1))}>+</button>
        {p.infinite && (
          <button className={`chip ${inf ? 'on' : ''}`} aria-pressed={inf} onClick={() => p.onChange(inf ? 1 : 0)}>∞ sans fin</button>
        )}
      </div>
    </div>
  );
}

interface VerseProps {
  verse: Verse;
  wordCount: number;
  enriched?: Enriched;
  active: boolean;
  activeWord: number;
  gap: boolean;
}

/** Un verset du groupe : texte arabe et translittération surlignés au rythme de la voix. */
const HifzVerse = memo(function HifzVerse({ verse: v, wordCount, enriched, active, activeWord, gap }: VerseProps) {
  const segments = useMemo(() => splitVerse(v.ar), [v.ar]);
  const tokens = useMemo(() => (enriched ? translitTokens(enriched.translit) : []), [enriched]);
  return (
    <article className={`verse-card hifz-verse ${active ? 'playing' : ''} ${gap ? 'is-gap' : ''}`} id={`h-${v.n}`}>
      <div className="verse-top-row">
        <div className="verse-number-badge">{v.n}</div>
        {gap && <span className="pill-badge">🗣️ À vous</span>}
      </div>
      <div className="arabic-text" lang="ar" dir="rtl">
        {segments.map((s, i) => {
          const cls = s.idx == null ? '' : s.idx === activeWord ? 'hw-now' : active && s.idx < activeWord ? 'hw-past' : '';
          return (
            <span key={i} className={cls || undefined}>
              {s.text}{' '}
            </span>
          );
        })}
      </div>
      {tokens.length > 0 && (
        <div className="translit-block hifz-translit">
          {tokens.map((t, k) => {
            const w = translitToWord(k, tokens.length, wordCount);
            return (
              <span key={k} className={w === activeWord && active ? 'tw-now' : active && w < activeWord ? 'tw-past' : undefined}>
                {t}{' '}
              </span>
            );
          })}
        </div>
      )}
    </article>
  );
});
