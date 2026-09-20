import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { Enriched, Meta, Verse } from '../types';
import { getEnriched, loadSurah } from '../lib/data';
import { normalizeArabic, splitVerse, tokenizeVerse } from '../lib/arabic';
import { firstLetters, maskFor, type HideMode } from '../lib/mask';
import { loadTimings, translitToWord, translitTokens, type VerseTimings } from '../lib/timing';
import { totalSteps, stepsPerGroup, type PauseMode } from '../lib/hifzPlan';
import { listBy, markKey, nextToLearn, totals, type Flag, type Marks, type VerseMark } from '../lib/marks';
import { unlockAudio } from '../lib/audioCache';
import { useHifz, type HifzConfig } from '../hooks/useHifz';
import { usePersisted } from '../lib/storage';
import VerseMarks from './VerseMarks';

export interface HifzSettings {
  verseRepeat: number;
  groupRepeat: number; // 0 = sans fin
  pause: PauseMode;
  showTranslit: boolean;
  hideMode: HideMode; // masquer le texte pour réciter de mémoire
  hideFrom: number; // à partir de la lecture n°
  hideListen: boolean; // aussi pendant que le récitateur lit
  hideTranslit: boolean; // masquer aussi la translittération (par défaut elle reste visible : c'est le « sous-titre »)
}

export const DEFAULT_HIFZ: HifzSettings = {
  verseRepeat: 3,
  groupRepeat: 1,
  pause: 'verse',
  showTranslit: true,
  hideMode: 'none',
  hideFrom: 2,
  hideListen: true,
  hideTranslit: false,
};
export const TEMPOS = [0.5, 0.6, 0.75, 0.9, 1, 1.15, 1.25] as const;

const PAUSES: { id: PauseMode; label: string; hint: string }[] = [
  { id: '0', label: 'Aucune', hint: 'Enchaîne directement' },
  { id: '1', label: '1 s', hint: '' },
  { id: '2', label: '2 s', hint: '' },
  { id: '3', label: '3 s', hint: '' },
  { id: 'verse', label: 'Durée du verset', hint: 'Le temps de répéter à voix haute après le récitateur' },
];

/** Méthodes prêtes à l'emploi : un choix simple au lieu de sept réglages à comprendre. */
const PRESETS = [
  {
    id: 'learn',
    icon: '📖',
    title: 'Apprendre',
    text: 'Chaque verset est lu 3 fois, lentement, texte visible, avec un temps pour le répéter.',
    s: { verseRepeat: 3, groupRepeat: 1, pause: 'verse', hideMode: 'none', hideFrom: 2, hideListen: true } as const,
    tempo: 0.75,
  },
  {
    id: 'consolidate',
    icon: '🧠',
    title: 'Consolider',
    text: 'Le texte se réduit aux premières lettres dès la 2e lecture, et on repasse 2 fois sur le groupe.',
    s: { verseRepeat: 3, groupRepeat: 2, pause: 'verse', hideMode: 'letters', hideFrom: 2, hideListen: true } as const,
    tempo: 1,
  },
  {
    id: 'test',
    icon: '🎯',
    title: 'Tester de mémoire',
    text: 'Le texte est caché pendant que vous récitez, et réapparaît quand le récitateur lit pour vous corriger.',
    s: { verseRepeat: 2, groupRepeat: 1, pause: 'verse', hideMode: 'hidden', hideFrom: 1, hideListen: false } as const,
    tempo: 1,
  },
] as const;

interface Props {
  meta: Meta;
  reciterId: string;
  onReciter: (id: string) => void;
  tempo: number;
  onTempo: (t: number) => void;
  settings: HifzSettings;
  onSettings: (s: HifzSettings) => void;
  /** Sélection venue d'ailleurs (bouton « Répéter » d'un verset) ; `autoStart` lance la lecture tout de suite. */
  preset: { surah: number; from: number; to: number; nonce: number; autoStart?: boolean } | null;
  marks: Marks;
  onFlag: (key: string, flag: Flag) => void;
  onFlags: (keys: string[], flag: Flag, value: boolean) => void;
  onNote: (key: string, text: string) => void;
  onOpen: (surah: number, verse: number) => void;
}

interface Sel {
  surah: number;
  from: number;
  to: number;
}

const fmtTempo = (t: number) => `${String(t).replace('.', ',')}×`;
const HIDE_LABEL: Record<HideMode, string> = { none: 'texte visible', letters: 'premières lettres', hidden: 'texte masqué' };

export default function Hifz(p: Props) {
  const { meta } = p;
  const [sel, setSel] = usePersisted<Sel>('hifzSel', { surah: 1, from: 1, to: 3 });
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [timings, setTimings] = useState<VerseTimings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set()); // versets dévoilés d'un toucher
  const [tempoOpen, setTempoOpen] = useState(false);
  const [doneDismissed, setDoneDismissed] = useState(false);
  const [pendingStart, setPendingStart] = useState<Sel | null>(null);

  const reciter = meta.reciters.find((r) => r.id === p.reciterId) ?? meta.reciters[0];
  const surah = meta.surahs[sel.surah - 1];
  const enriched = useMemo(() => getEnriched(sel.surah), [sel.surah]);

  // Sélection imposée depuis un autre écran
  useEffect(() => {
    if (!p.preset) return;
    const s = { surah: p.preset.surah, from: p.preset.from, to: p.preset.to };
    setSel(s);
    if (p.preset.autoStart) setPendingStart(s);
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

  // Un verset dévoilé d'un toucher se recache à la lecture suivante
  useEffect(() => {
    setRevealed(new Set());
  }, [state.verse, state.verseRep]);
  useEffect(() => {
    if (state.status !== 'done') setDoneDismissed(false);
  }, [state.status]);

  const curIndex = state.verse == null ? null : group.findIndex((g) => g.n === state.verse);
  const hideOpts = { mode: p.settings.hideMode, hideFrom: p.settings.hideFrom, hideListen: p.settings.hideListen, verseRepeat: p.settings.verseRepeat };
  const maskOf = (verseIndex: number, n: number): HideMode =>
    revealed.has(n) ? 'none' : maskFor(hideOpts, verseIndex, { status: state.status, index: curIndex === -1 ? null : curIndex, rep: state.verseRep, group: state.groupRep });
  // Référence stable : sinon tous les versets seraient redessinés à chaque mot surligné
  const toggleReveal = useCallback(
    (n: number) =>
      setRevealed((r) => {
        const next = new Set(r);
        if (!next.delete(n)) next.add(n);
        return next;
      }),
    [],
  );

  // Si on change de sourate, de plage ou de récitateur, on arrête la lecture en cours
  useEffect(() => {
    player.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.surah, from, to, reciter.id]);

  // Lecture demandée depuis un autre écran, une fois la sélection chargée
  useEffect(() => {
    if (!pendingStart || !verses || !group.length) return;
    if (sel.surah !== pendingStart.surah || from !== pendingStart.from || to !== pendingStart.to) return;
    setPendingStart(null);
    player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStart, verses, group.length, sel.surah, from, to]);

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

  // Progression personnelle
  const tot = useMemo(() => totals(p.marks, meta.surahs), [p.marks, meta.surahs]);
  const next = useMemo(() => nextToLearn(p.marks, meta.surahs, sel.surah), [p.marks, meta.surahs, sel.surah]);
  const favs = useMemo(() => listBy(p.marks, 'f'), [p.marks]);
  const notes = useMemo(() => listBy(p.marks, 'n'), [p.marks]);

  // Méthode active (ou « personnalisée » si les réglages ont été ajustés à la main)
  const activePreset = PRESETS.find(
    (x) =>
      x.tempo === p.tempo &&
      x.s.verseRepeat === p.settings.verseRepeat &&
      x.s.groupRepeat === p.settings.groupRepeat &&
      x.s.pause === p.settings.pause &&
      x.s.hideMode === p.settings.hideMode &&
      x.s.hideFrom === p.settings.hideFrom &&
      x.s.hideListen === p.settings.hideListen,
  );
  const applyPreset = (id: (typeof PRESETS)[number]['id']) => {
    const x = PRESETS.find((y) => y.id === id)!;
    p.onSettings({ ...p.settings, ...x.s });
    p.onTempo(x.tempo);
  };

  const notMemorized = group.filter((g) => !p.marks[markKey(sel.surah, g.n)]?.m);
  const surahName = (n: number) => meta.surahs[n - 1].fr;
  const goSession = (s: Sel, start = false) => {
    if (start) unlockAudio(); // débloque le son pendant l'appui (iOS)
    setSel(s);
    if (start) setPendingStart(s);
    document.getElementById('hifz-session')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className={`tab-content fade-in ${busy || state.status === 'done' ? 'has-voice-bar' : ''}`}>
      {/* ------- Où j'en suis ------- */}
      <div className="guide-card hifz-hub">
        <h2 className="guide-title">🧭 Ma mémorisation</h2>
        <div className="stat-row">
          <div className="stat"><strong>{tot.verses}</strong><span>verset{tot.verses > 1 ? 's' : ''} ✅</span></div>
          <div className="stat"><strong>{tot.complete}</strong><span>sourate{tot.complete > 1 ? 's' : ''} complète{tot.complete > 1 ? 's' : ''}</span></div>
          <div className="stat"><strong>{tot.favorites}</strong><span>♥ favori{tot.favorites > 1 ? 's' : ''}</span></div>
          <div className="stat"><strong>{tot.notes}</strong><span>📝 note{tot.notes > 1 ? 's' : ''}</span></div>
        </div>
        {next ? (
          <button className="btn btn-primary hub-continue" onClick={() => goSession(next, true)}>
            ▶ Continuer : {surahName(next.surah)}, {next.from === next.to ? `verset ${next.from}` : `versets ${next.from} à ${next.to}`}
          </button>
        ) : (
          <p className="voice-perfect">✓ Tous les versets sont marqués comme mémorisés. Mā shā’ Allāh !</p>
        )}
        <p className="hifz-note">Cochez « ✅ Mémorisé » sur un verset (ici ou dans Récitation) pour suivre où vous en êtes ; « Continuer » propose la suite.</p>
      </div>

      {/* ------- Session : versets → méthode → lancer ------- */}
      <div className="guide-card hifz-card" id="hifz-session">
        <h2 className="guide-title">🔁 Nouvelle session</h2>

        <h3 className="hifz-h">1 · Quels versets ?</h3>
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

        <h3 className="hifz-h">2 · Quelle méthode ?</h3>
        <div className="preset-list" role="radiogroup" aria-label="Méthode de mémorisation">
          {PRESETS.map((x) => (
            <button key={x.id} role="radio" aria-checked={activePreset?.id === x.id} className={`preset ${activePreset?.id === x.id ? 'on' : ''}`} onClick={() => applyPreset(x.id)}>
              <span className="preset-title"><span aria-hidden="true">{x.icon}</span> {x.title}</span>
              <span className="preset-text">{x.text}</span>
            </button>
          ))}
        </div>
        {!activePreset && <p className="hifz-note">Méthode personnalisée (réglages avancés modifiés).</p>}

        <details className="hifz-adv">
          <summary>⚙ Réglages avancés</summary>

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
          <TempoChips value={p.tempo} onChange={p.onTempo} />
          <p className="hifz-note">Ralentir garde la voix naturelle. Vous pouvez aussi changer le tempo pendant la lecture (bouton ⏱).</p>

          <h3 className="hifz-h">Réciter de mémoire (masquer le texte)</h3>
          <div className="chips" role="radiogroup" aria-label="Masquage du texte">
            {([['none', 'Texte visible'], ['letters', 'Premières lettres'], ['hidden', 'Masqué']] as const).map(([id, label]) => (
              <button key={id} role="radio" aria-checked={p.settings.hideMode === id} className={`chip ${p.settings.hideMode === id ? 'on' : ''}`} onClick={() => setSettings({ hideMode: id })}>
                {label}
              </button>
            ))}
          </div>
          {p.settings.hideMode !== 'none' && (
            <>
              <div className="hifz-grid">
                <Stepper label="Masquer à partir de la lecture n°" value={Math.min(p.settings.hideFrom, p.settings.verseRepeat)} min={1} max={p.settings.verseRepeat} suffix="" onChange={(v) => setSettings({ hideFrom: v })} />
              </div>
              <label className="hifz-check">
                <input type="checkbox" checked={p.settings.hideListen} onChange={(e) => setSettings({ hideListen: e.target.checked })} />
                Masquer aussi pendant que le récitateur lit
              </label>
              <label className="hifz-check">
                <input type="checkbox" checked={p.settings.hideTranslit} onChange={(e) => setSettings({ hideTranslit: e.target.checked })} />
                Masquer aussi la translittération (sinon elle reste comme sous-titre)
              </label>
              <p className="hifz-note">Touchez un verset pour le dévoiler, ou mettez en pause : tout se dévoile.</p>
            </>
          )}

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
        </details>

        <div className="launch">
          <p className="launch-recap">
            {group.length} verset{group.length > 1 ? 's' : ''} · chacun {p.settings.verseRepeat}× · tempo {fmtTempo(p.tempo)} · {HIDE_LABEL[p.settings.hideMode]}
          </p>
          {busy ? (
            <button className="btn launch-btn" onClick={player.stop}>⏹ Arrêter la session</button>
          ) : (
            <button className="btn btn-primary launch-btn" onClick={player.play} disabled={!group.length}>▶ Lancer la session</button>
          )}
        </div>
      </div>

      {loadError && <div className="notice notice-error" role="alert">Impossible de charger la sourate. Vérifiez votre connexion.</div>}
      {!verses && !loadError && <div className="loading">Chargement…</div>}

      {state.status === 'done' && notMemorized.length > 0 && !doneDismissed && (
        <div className="notice done-card" role="status">
          <strong>✓ Session terminée.</strong> Marquer {notMemorized.length > 1 ? `ces ${notMemorized.length} versets` : 'ce verset'} comme mémorisé{notMemorized.length > 1 ? 's' : ''} ?
          <span className="done-actions">
            <button className="btn btn-primary" onClick={() => { p.onFlags(notMemorized.map((g) => markKey(sel.surah, g.n)), 'm', true); setDoneDismissed(true); }}>✅ Oui, marquer</button>
            <button className="btn" onClick={() => setDoneDismissed(true)}>Pas encore</button>
          </span>
        </div>
      )}

      {group.map(({ verse, n, words }, i) => (
        <HifzVerse
          key={n}
          mask={maskOf(i, n)}
          hideTranslit={p.settings.hideTranslit}
          onToggle={toggleReveal}
          verse={verse}
          vkey={markKey(sel.surah, n)}
          mark={p.marks[markKey(sel.surah, n)]}
          onFlag={p.onFlag}
          onNote={p.onNote}
          wordCount={words.length}
          enriched={p.settings.showTranslit ? enriched?.get(n) : undefined}
          active={state.verse === n && busy}
          activeWord={state.verse === n && busy ? state.word : -1}
          gap={state.verse === n && state.status === 'gap'}
        />
      ))}

      {/* ------- Favoris et notes ------- */}
      {favs.length > 0 && (
        <div className="guide-card">
          <h3 className="guide-title">♥ Mes favoris ({favs.length})</h3>
          <ul className="mark-list">
            {favs.map((f) => (
              <li key={`${f.surah}:${f.verse}`}>
                <span>{surahName(f.surah)} · verset {f.verse}</span>
                <span className="mark-list-actions">
                  <button className="link-btn" onClick={() => p.onOpen(f.surah, f.verse)}>Lire</button>
                  <button className="link-btn" onClick={() => goSession({ surah: f.surah, from: f.verse, to: f.verse })}>🔁 Mémoriser</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {notes.length > 0 && (
        <div className="guide-card">
          <h3 className="guide-title">📝 Mes notes ({notes.length})</h3>
          <ul className="mark-list">
            {notes.map((f) => (
              <li key={`${f.surah}:${f.verse}`} className="mark-note-item">
                <span><strong>{surahName(f.surah)} · verset {f.verse}</strong><br /><span className="muted">{f.mark.n}</span></span>
                <span className="mark-list-actions">
                  <button className="link-btn" onClick={() => p.onOpen(f.surah, f.verse)}>Lire</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ------- Barre de lecture ------- */}
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
          {total !== null && state.status === 'idle' && <span className="muted">{total} lectures au total</span>}
          {total === null && state.status === 'idle' && <span className="muted">{perGroup} lectures par passage, sans fin</span>}
        </div>

        <div className="progress-track small">
          <div className="progress-fill" style={{ width: `${state.status === 'gap' ? (state.gapTotalMs ? (1 - state.gapLeftMs / state.gapTotalMs) * 100 : 0) : state.progress * 100}%` }} />
        </div>
        {state.status === 'gap' && <div className="muted">Reprise dans {(state.gapLeftMs / 1000).toFixed(1)} s</div>}
        {state.status === 'error' && state.error && <div className="voice-error">{state.error}</div>}
        {busy && !state.synced && state.word >= 0 && !synced && <div className="voice-hint">Surlignage estimé (récitateur sans horodatage exact).</div>}

        {tempoOpen && (
          <div className="tempo-pop" role="dialog" aria-label="Tempo de la récitation">
            <TempoChips value={p.tempo} onChange={(t) => { p.onTempo(t); setTempoOpen(false); }} />
          </div>
        )}

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
          <button className={`btn tempo-btn ${tempoOpen ? 'on' : ''}`} onClick={() => setTempoOpen((o) => !o)} aria-expanded={tempoOpen} aria-label={`Tempo, actuellement ${fmtTempo(p.tempo)}`}>
            ⏱ {fmtTempo(p.tempo)}
          </button>
          <button className="btn" onClick={player.stop} disabled={!busy && state.status !== 'done'} aria-label="Arrêter">⏹</button>
        </div>
      </div>
    </section>
  );
}

function TempoChips(p: { value: number; onChange: (t: number) => void }) {
  return (
    <div className="chips" role="radiogroup" aria-label="Vitesse de la récitation">
      {TEMPOS.map((t) => (
        <button key={t} role="radio" aria-checked={p.value === t} className={`chip ${p.value === t ? 'on' : ''}`} onClick={() => p.onChange(t)}>
          {fmtTempo(t)}
        </button>
      ))}
    </div>
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
  mask: HideMode;
  hideTranslit: boolean;
  onToggle: (n: number) => void;
  vkey: string;
  mark?: VerseMark;
  onFlag: (key: string, flag: Flag) => void;
  onNote: (key: string, text: string) => void;
  wordCount: number;
  enriched?: Enriched;
  active: boolean;
  activeWord: number;
  gap: boolean;
}

/** Un verset du groupe : texte arabe et translittération surlignés au rythme de la voix. */
const HifzVerse = memo(function HifzVerse({ verse: v, mask, hideTranslit, onToggle, vkey, mark, onFlag, onNote, wordCount, enriched, active, activeWord, gap }: VerseProps) {
  const segments = useMemo(() => splitVerse(v.ar), [v.ar]);
  const tokens = useMemo(() => (enriched ? translitTokens(enriched.translit) : []), [enriched]);
  // La translittération reste affichée comme « sous-titre », même quand le texte arabe est masqué (sauf réglage contraire)
  const showTranslit = tokens.length > 0 && !(hideTranslit && mask !== 'none');
  return (
    <article
      className={`verse-card hifz-verse ${active ? 'playing' : ''} ${gap ? 'is-gap' : ''} ${mask !== 'none' ? 'is-masked' : ''}`}
      id={`h-${v.n}`}
      onClick={mask !== 'none' ? () => onToggle(v.n) : undefined}
      title={mask !== 'none' ? 'Touchez pour dévoiler le verset' : undefined}
    >
      <div className="verse-top-row">
        <div className="verse-number-badge">{v.n}</div>
        {gap && <span className="pill-badge">🗣️ À vous</span>}
        {mask !== 'none' && <span className="pill-badge">👁 Touchez pour voir</span>}
      </div>
      <div className="arabic-text" lang="ar" dir="rtl">
        {segments.map((s, i) => {
          const cls = s.idx == null ? '' : s.idx === activeWord ? 'hw-now' : active && s.idx < activeWord ? 'hw-past' : '';
          if (mask === 'hidden') {
            if (s.idx == null) return null; // signes de pause : rien à montrer
            // repère de la longueur du mot : on sait combien de mots réciter, sans voir lesquels
            const w = Math.max(1.2, normalizeArabic(s.text).length * 0.42);
            return <span key={i} className={`hw-mask ${cls}`.trim()} style={{ width: `${w}em` }} aria-hidden="true" />;
          }
          if (mask === 'letters') {
            if (s.idx == null) return null;
            return (
              <span key={i} className={`hw-hint ${cls}`.trim()} aria-hidden="true">
                {firstLetters(s.text)}…{' '}
              </span>
            );
          }
          return (
            <span key={i} className={cls || undefined}>
              {s.text}{' '}
            </span>
          );
        })}
      </div>
      {showTranslit && (
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
      {/* Les marques ne doivent pas dévoiler le verset quand on touche un bouton */}
      <div onClick={(e) => e.stopPropagation()}>
        <VerseMarks vkey={vkey} mark={mark} onFlag={onFlag} onNote={onNote} />
      </div>
    </article>
  );
});
