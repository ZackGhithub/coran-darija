import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Enriched, Meta, Quarter, Verse } from '../types';
import { getEnriched, loadSurah } from '../lib/data';
import { StreamAligner, splitVerse, summarize, tokenizeSpoken, tokenizeVerse, type WordStatus } from '../lib/arabic';
import { hizbRangeOfSurah, indexQuarters, markerFor, quarterKey } from '../lib/hizb';
import { usePersisted, type VerseStat } from '../lib/storage';
import { useAudio } from '../hooks/useAudio';
import { isStandaloneIOS, useSpeech } from '../hooks/useSpeech';
import { unlockAudio } from '../lib/audioCache';
import { markKey, type Flag, type Marks, type VerseMark } from '../lib/marks';
import VerseMarks from './VerseMarks';
import Icon from './Icon';
import TajweedSheet, { type SheetTarget } from './TajweedSheet';
import { decodeSpans, loadTajweed, wordPieces, type Fragment } from '../lib/tajweed';
import { TAJWEED_CODES } from '../lib/tajweedCodes';
import { RULE_BY_CODE, ruleColorVar } from '../content/tajweedRules';

const shortRuleName = (code: string) => RULE_BY_CODE[code].fr.replace(/\s*\(.*\)\s*$/, '');

interface Props {
  meta: Meta;
  surahNum: number;
  onSurah: (n: number) => void;
  focusVerse: number | null;
  learned: number[];
  onToggleLearned: (n: number) => void;
  fontSize: number;
  onFontSize: (v: number) => void;
  reciterId: string;
  onReciter: (id: string) => void;
  repeat: 1 | 3 | 5;
  onRepeat: (v: 1 | 3 | 5) => void;
  tempo: number;
  onTempo: (t: number) => void;
  onHifz: (surah: number, from: number, to: number, autoStart?: boolean) => void;
  marks: Marks;
  onFlag: (key: string, flag: Flag) => void;
  onNote: (key: string, text: string) => void;
  verseStats: Record<string, VerseStat>;
  onVerseStat: (key: string, stat: VerseStat) => void;
}

const STYLE_LABEL = { murattal: 'Murattal', mujawwad: 'Mujawwad', muallim: 'Pédagogique' } as const;
const NO_STATUS: WordStatus[] = [];

/** Une session de récitation vocale : un verset ou une suite de versets, comparés comme un seul texte continu. */
interface VoiceCfg {
  from: number;
  to: number;
  verseNums: number[];
  offsets: number[]; // index du premier mot de chaque verset dans le texte continu (+ total à la fin)
  startAt: number; // mot de départ (reprise)
  aligner: StreamAligner;
}

export default function Recitation(p: Props) {
  const { meta, surahNum } = p;
  const surah = meta.surahs[surahNum - 1];
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collapse, setCollapse] = useState<{ n: number; open: boolean }>({ n: 0, open: false });
  const [range, setRange] = useState({ from: 1, to: surah.verses });
  const [cfg, setCfg] = useState<VoiceCfg | null>(null);
  const wasListening = useRef(false);
  const [sheet, setSheet] = useState<SheetTarget | null>(null); // fiche de Tajwid ouverte

  const reciter = meta.reciters.find((r) => r.id === p.reciterId) ?? meta.reciters[0];
  const audio = useAudio(reciter, p.repeat, p.tempo);
  const speech = useSpeech('ar-SA');
  const quarterIdx = useMemo(() => indexQuarters(meta.quarters), [meta.quarters]);
  const enriched = useMemo(() => getEnriched(surahNum), [surahNum]);
  const hizb = useMemo(() => hizbRangeOfSurah(meta.quarters, surahNum, surah.verses), [meta.quarters, surahNum, surah.verses]);

  // Changement de sourate : on repart de zéro
  useEffect(() => {
    let alive = true;
    setVerses(null);
    setLoadError(null);
    setCfg(null);
    setRange({ from: 1, to: surah.verses });
    audio.stop();
    speech.stop();
    loadSurah(surahNum)
      .then((v) => alive && setVerses(v))
      .catch(() => alive && setLoadError('Impossible de charger cette sourate. Réessayez.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahNum]);

  useEffect(() => {
    if (!verses || p.focusVerse == null) return;
    const t = setTimeout(() => document.getElementById(`v-${p.focusVerse}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [verses, p.focusVerse, surahNum]);

  // Suit le verset lu à voix haute
  useEffect(() => {
    if (audio.playing) document.getElementById(`v-${audio.playing.verse}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [audio.playing]);

  // --- Tajwid en couleur : chaque règle a sa couleur ; toucher un mot coloré ouvre sa fiche ---------------------------------
  const [tajweedOn, setTajweedOn] = usePersisted<boolean>('tajweed', false);
  const [tjData, setTjData] = useState<Record<number, number[]> | null>(null);
  const [tjError, setTjError] = useState(false);
  useEffect(() => {
    if (!tajweedOn) return;
    let alive = true;
    setTjData(null);
    setTjError(false);
    loadTajweed(surahNum)
      .then((d) => alive && setTjData(d))
      .catch(() => alive && setTjError(true));
    return () => {
      alive = false;
    };
  }, [tajweedOn, surahNum]);
  const tjByVerse = useMemo(() => {
    const m = new Map<number, Fragment[]>();
    if (tjData) for (const [k, flat] of Object.entries(tjData)) m.set(Number(k), decodeSpans(flat));
    return m;
  }, [tjData]);
  const tjRef = useRef(tjByVerse);
  tjRef.current = tjByVerse;
  /** Règles présentes dans cette sourate (pour la légende). */
  const presentRules = useMemo(() => {
    const set = new Set<number>();
    tjByVerse.forEach((frs) => frs.forEach((f) => set.add(f.rule)));
    return [...set].sort((a, b) => a - b);
  }, [tjByVerse]);
  const refReciter = meta.reciters.find((r) => r.id === 'alafasy') ?? meta.reciters[0];

  // --- Comparaison de ce qui est dit avec le texte -------------------------------------------------------------
  const spoken = useMemo(() => tokenizeSpoken(speech.transcript), [speech.transcript]);
  const statuses = useMemo(
    () => (cfg ? cfg.aligner.update(spoken, { provisionalLast: speech.interim }) : NO_STATUS),
    [cfg, spoken, speech.interim],
  );
  const summary = useMemo(() => summarize(statuses), [statuses]);

  /** Statuts découpés par verset ; on garde le même tableau tant qu'il ne change pas (évite de redessiner tous les versets). */
  const sliceCache = useRef(new Map<number, WordStatus[]>());
  const slices = useMemo(() => {
    const out = new Map<number, WordStatus[]>();
    if (!cfg) {
      sliceCache.current.clear();
      return out;
    }
    cfg.verseNums.forEach((n, i) => {
      const s = statuses.slice(cfg.offsets[i], cfg.offsets[i + 1]);
      const old = sliceCache.current.get(n);
      const same = old && old.length === s.length && old.every((x, k) => x === s[k]);
      const use = same ? old : s;
      sliceCache.current.set(n, use);
      out.set(n, use);
    });
    return out;
  }, [cfg, statuses]);

  /** Verset en cours de récitation : premier mot pas encore traité, à partir du point de départ. */
  const currentVerse = useMemo(() => {
    if (!cfg) return null;
    const k = statuses.findIndex((s, i) => i >= cfg.startAt && s === 'pending');
    if (k < 0) return cfg.verseNums[cfg.verseNums.length - 1];
    const i = cfg.offsets.findIndex((o, idx) => k >= o && k < cfg.offsets[idx + 1]);
    return cfg.verseNums[Math.max(i, 0)];
  }, [cfg, statuses]);

  // Récitation longue : la page suit le verset en cours
  const multi = !!cfg && cfg.verseNums.length > 1;
  useEffect(() => {
    if (multi && speech.listening && currentVerse != null) {
      document.getElementById(`v-${currentVerse}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [multi, speech.listening, currentVerse]);

  // Dernier mot atteint : on arrête le micro tout seul
  const reachedEnd = statuses.length > 0 && statuses[statuses.length - 1] === 'ok';
  useEffect(() => {
    if (reachedEnd && speech.listening) speech.stop();
  }, [reachedEnd, speech.listening, speech.stop]);

  // Fin d'écoute : on enregistre le résultat de chaque verset traité. Court délai : le moteur peut encore rendre
  // les derniers mots après « Terminer ». On lit alors les valeurs les plus récentes via une référence.
  const latest = useRef({ cfg, statuses, stats: p.verseStats, surahNum });
  latest.current = { cfg, statuses, stats: p.verseStats, surahNum };
  useEffect(() => {
    if (speech.listening) {
      wasListening.current = true;
      return;
    }
    if (!wasListening.current) return;
    wasListening.current = false;
    window.setTimeout(() => {
      const { cfg: c, statuses: st, stats, surahNum: sn } = latest.current;
      if (!c) return;
      c.verseNums.forEach((n, i) => {
        const s = st.slice(c.offsets[i], c.offsets[i + 1]);
        const attempted = s.filter((x) => x !== 'pending').length;
        // Un verset seul compte dès qu'un mot est traité ; dans une suite, seuls les versets menés jusqu'au bout comptent.
        if (attempted === 0 || (c.verseNums.length > 1 && attempted < s.length)) return;
        const ok = s.filter((x) => x === 'ok').length;
        const key = quarterKey(sn, n);
        const prev = stats[key];
        p.onVerseStat(key, {
          attempts: (prev?.attempts ?? 0) + 1,
          perfect: (prev?.perfect ?? 0) + (ok === s.length ? 1 : 0),
          bestOk: Math.max(prev?.bestOk ?? 0, ok),
          total: s.length,
          last: Date.now(),
        });
      });
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.listening]);

  // --- Actions (stables : les versets ne sont redessinés que si leurs propres données changent) --------------------
  const act = useRef({ verses, cfg, statuses, audio, speech, surahNum });
  act.current = { verses, cfg, statuses, audio, speech, surahNum };
  const onHifzRef = useRef(p.onHifz);
  onHifzRef.current = p.onHifz;

  /** Démarre la récitation vocale d'un verset ou d'une suite ; `fromWord` reprend au mot k de la même suite. */
  const startVoice = useCallback((from: number, to: number, fromWord = 0) => {
    const a = act.current;
    const vs = a.verses?.filter((v) => v.n >= from && v.n <= to) ?? [];
    if (!vs.length) return;
    const words: string[] = [];
    const offsets = [0];
    vs.forEach((v) => {
      words.push(...tokenizeVerse(v.ar));
      offsets.push(words.length);
    });
    const same = !!a.cfg && a.cfg.from === from && a.cfg.to === to;
    const start = same ? fromWord : 0; // on ne reprend qu'à l'intérieur de la suite déjà en cours
    const head = start > 0 ? a.statuses.slice(0, start) : [];
    setCfg({ from, to, verseNums: vs.map((v) => v.n), offsets, startAt: start, aligner: new StreamAligner(words, start, head) });
    a.audio.stop();
    a.speech.start(); // remet le moteur et le texte reconnu à zéro
  }, []);

  const stopVoice = useCallback(() => act.current.speech.stop(), []);
  const onVerseVoice = useCallback((n: number) => startVoice(n, n), [startVoice]);
  const onWordTap = useCallback(
    (n: number, idx: number) => {
      const c = act.current.cfg;
      const i = c ? c.verseNums.indexOf(n) : -1;
      if (c && i >= 0) startVoice(c.from, c.to, c.offsets[i] + idx);
    },
    [startVoice],
  );
  // Le micro ne doit pas « entendre » le récitateur : on coupe l'écoute avant de lancer l'audio.
  const playVerses = useCallback((verseNums: number[]) => {
    const a = act.current;
    a.speech.stop();
    a.audio.playVerses(a.surahNum, verseNums);
  }, []);
  const onPlayVerse = useCallback((n: number) => playVerses([n]), [playVerses]);
  /** Toucher un mot coloré : ouvre la fiche de ses règles (et coupe l'audio et le micro en cours). */
  const openTajweed = useCallback((n: number, idx: number, start: number, end: number) => {
    const a = act.current;
    const v = a.verses?.find((x) => x.n === n);
    const frags = tjRef.current.get(n);
    if (!v || !frags) return;
    a.speech.stop();
    a.audio.stop();
    setSheet({ kind: 'word', surah: a.surahNum, verse: n, verseText: v.ar, wordIdx: idx, wordCount: tokenizeVerse(v.ar).length, wordStart: start, wordEnd: end, frags });
  }, []);
  const stopForSheet = useCallback(() => {
    act.current.speech.stop();
    act.current.audio.stop();
  }, []);
  // « Répéter » : ouvre le module de mémorisation sur ce verset et le lance. Le son est débloqué ici, pendant l'appui
  // (iOS l'exige), avant de changer d'onglet.
  const onRepeat = useCallback(
    (n: number) => {
      const a = act.current;
      a.speech.stop();
      a.audio.stop();
      unlockAudio();
      onHifzRef.current(a.surahNum, n, n, true);
    },
    [],
  );

  /** « Aller au verset » : défilement vers le verset, avec un bref halo pour le repérer. */
  const jumpTo = (n: number) => {
    const el = document.getElementById(`v-${n}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('jumped');
    window.setTimeout(() => el.classList.remove('jumped'), 1600);
  };

  const isLearned = p.learned.includes(surahNum);
  const playingVerse = audio.playing?.surah === surahNum ? audio.playing.verse : null;
  const groups = (['murattal', 'muallim', 'mujawwad'] as const).map((s) => ({ s, list: meta.reciters.filter((r) => r.style === s) })).filter((g) => g.list.length);
  const verseOptions = Array.from({ length: surah.verses }, (_, i) => i + 1);
  const heard = speech.transcript.split(/\s+/).filter(Boolean).slice(-10).join(' ');

  return (
    <main className={`tab-content fade-in ${cfg ? 'has-voice-bar' : ''}`}>
      <div className="jump-bar">
        <select className="surah-select" value={surahNum} onChange={(e) => p.onSurah(Number(e.target.value))} aria-label="Choisir la sourate">
          {meta.surahs.map((s) => (
            <option key={s.n} value={s.n}>
              {s.n}. {s.fr}{p.learned.includes(s.n) ? ' (apprise)' : ''}
            </option>
          ))}
        </select>
        <select
          className="surah-select verse-jump"
          value=""
          disabled={!verses}
          onChange={(e) => e.target.value && jumpTo(Number(e.target.value))}
          aria-label="Aller au verset"
        >
          <option value="">Verset…</option>
          {verseOptions.map((n) => (
            <option key={n} value={n}>Verset {n}</option>
          ))}
        </select>
      </div>

      <section className="surah-header-card">
        <h2 className="surah-arabic-title" lang="ar" dir="rtl">{surah.ar}</h2>
        <div className="surah-french-title">{surah.n}. {surah.fr} ({surah.tr})</div>
        <div className="surah-badges">
          <span className="pill-badge">{surah.verses} versets</span>
          <span className="pill-badge">{surah.type}</span>
          <span className="pill-badge">{hizb.from === hizb.to ? `Hizb ${hizb.from}` : <>Hizb {hizb.from} <Icon name="right" size="0.95em" /> {hizb.to}</>}</span>
          <button className={`pill-btn pill-badge ${isLearned ? 'is-learned' : ''}`} onClick={() => p.onToggleLearned(surahNum)} aria-pressed={isLearned}>
            {isLearned ? <><Icon name="done" filled={false} /> Mémorisée</> : <><Icon name="todo" /> Marquer comme apprise</>}
          </button>
        </div>
      </section>

      <div className="recitation-toolbar">
        <div className="audio-group">
          <label className="reciter-label">
            <span>Récitateur</span>
            <select className="surah-select reciter-select" value={reciter.id} onChange={(e) => p.onReciter(e.target.value)} aria-label="Choisir le récitateur">
              {groups.map((g) => (
                <optgroup key={g.s} label={STYLE_LABEL[g.s]}>
                  {g.list.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} — {r.country}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {audio.playing ? (
            <button className="btn" onClick={audio.stop}><Icon name="stop" filled /> Arrêter</button>
          ) : (
            <button className="btn btn-primary" disabled={!verses} onClick={() => verses && playVerses(verses.map((v) => v.n))}>
              <Icon name="play" filled /> Écouter la sourate
            </button>
          )}
          <button className="btn" onClick={() => p.onRepeat(p.repeat === 1 ? 3 : p.repeat === 3 ? 5 : 1)} title="Nombre de lectures de chaque verset">
            Boucle : {p.repeat}×
          </button>
          <select className="surah-select tempo-select" value={p.tempo} onChange={(e) => p.onTempo(Number(e.target.value))} aria-label="Vitesse de la récitation" title="Vitesse de la récitation">
            {[0.5, 0.6, 0.75, 0.9, 1, 1.15, 1.25].map((t) => (
              <option key={t} value={t}>Vitesse {String(t).replace('.', ',')}×</option>
            ))}
          </select>
        </div>
        <div className="font-group">
          <span className="font-label">Taille arabe :</span>
          <button className="btn btn-icon" aria-label="Réduire" onClick={() => p.onFontSize(Math.max(1.2, +(p.fontSize - 0.15).toFixed(2)))}><Icon name="minus" /></button>
          <button className="btn btn-icon" aria-label="Agrandir" onClick={() => p.onFontSize(Math.min(3, +(p.fontSize + 0.15).toFixed(2)))}><Icon name="plus" /></button>
          <button className="btn-action-compact" onClick={() => setCollapse((c) => ({ n: c.n + 1, open: false }))}><Icon name="collapse" /> Tout réduire</button>
          <button className="btn-action-compact" onClick={() => setCollapse((c) => ({ n: c.n + 1, open: true }))}><Icon name="expand" /> Tout afficher</button>
          <button className={`btn-action-compact ${tajweedOn ? 'on' : ''}`} aria-pressed={tajweedOn} onClick={() => setTajweedOn((v) => !v)} title="Colorer les règles de Tajwid dans le texte">
            <Icon name="palette" /> Tajwid en couleur
          </button>
        </div>
      </div>

      {tajweedOn && (
        <div className="tj-legend" aria-label="Légende des couleurs du Tajwid">
          <p className="tj-legend-title">
            <Icon name="tajweed" /> Touchez un mot coloré pour comprendre sa règle, ou choisissez une règle :
          </p>
          {tjError && <p className="voice-error">Impossible de charger les couleurs du Tajwid. Vérifiez la connexion.</p>}
          {!tjData && !tjError && <p className="muted">Chargement des couleurs…</p>}
          <div className="tj-legend-chips">
            {presentRules.map((r) => (
              <button key={r} className="tj-chip" onClick={() => setSheet({ kind: 'rule', code: TAJWEED_CODES[r] })}>
                <span className="tj-dot" style={{ background: ruleColorVar(TAJWEED_CODES[r]) }} aria-hidden="true" />
                {shortRuleName(TAJWEED_CODES[r])}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="range-bar">
        <span className="range-title"><Icon name="mic" /> Récitation continue</span>
        <label className="range-field">
          <span>du verset</span>
          <select className="surah-select" value={range.from} onChange={(e) => { const from = Number(e.target.value); setRange((r) => ({ from, to: Math.max(r.to, from) })); }} aria-label="Premier verset à réciter">
            {verseOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="range-field">
          <span>au verset</span>
          <select className="surah-select" value={range.to} onChange={(e) => { const to = Number(e.target.value); setRange((r) => ({ from: Math.min(r.from, to), to })); }} aria-label="Dernier verset à réciter">
            {verseOptions.filter((n) => n >= range.from).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button className="btn-action-compact" onClick={() => setRange({ from: 1, to: surah.verses })}>Toute la sourate</button>
        <button className="btn-action-compact" onClick={() => p.onHifz(surahNum, range.from, range.to)} title="Répéter ces versets avec le récitateur (module Hifz)"><Icon name="repeat" /> Mémoriser (Hifz)</button>
        <button
          className="btn btn-primary"
          disabled={!verses || !speech.supported || speech.listening}
          title={speech.supported ? undefined : 'Reconnaissance vocale indisponible sur ce navigateur'}
          onClick={() => {
            if (verses) jumpTo(range.from);
            startVoice(range.from, range.to);
          }}
        >
          <Icon name="mic" /> Démarrer
        </button>
      </div>

      {audio.error && <div className="notice notice-error" role="alert">{audio.error}</div>}

      {surahNum !== 1 && surahNum !== 9 && (
        <div className="bismillah-card" lang="ar" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>
      )}

      {loadError && <div className="notice notice-error" role="alert">{loadError}</div>}
      {!verses && !loadError && <div className="loading">Chargement des versets…</div>}

      {verses?.map((v) => (
        <VerseBlock
          key={v.n}
          verse={v}
          quarter={quarterIdx.get(quarterKey(surahNum, v.n))}
          enriched={enriched?.get(v.n)}
          collapse={collapse}
          stat={p.verseStats[quarterKey(surahNum, v.n)]}
          playing={playingVerse === v.n}
          slice={slices.get(v.n)}
          listening={speech.listening && slices.has(v.n)}
          voiceSupported={speech.supported}
          onPlay={onPlayVerse}
          onRepeat={onRepeat}
          mark={p.marks[markKey(surahNum, v.n)]}
          vkey={markKey(surahNum, v.n)}
          onFlag={p.onFlag}
          onNote={p.onNote}
          onVoiceStart={onVerseVoice}
          onVoiceStop={stopVoice}
          onWordTap={onWordTap}
          tj={tajweedOn ? tjByVerse.get(v.n) : undefined}
          onTajweed={openTajweed}
        />
      ))}

      {cfg && (
        <div className="voice-bar" role="status" aria-live="polite">
          <div className="voice-bar-row">
            <span className="voice-bar-state">
              {speech.listening ? <><span className="rec-dot" aria-hidden="true" />À l&apos;écoute</> : 'Terminé'}
            </span>
            <span className="voice-bar-where">
              {cfg.from === cfg.to ? `Verset ${cfg.from}` : `Versets ${cfg.from}–${cfg.to}`}
              {speech.listening && multi && currentVerse != null ? ` · en cours : ${currentVerse}` : ''}
            </span>
            <span className="w-ok-txt"><strong><Icon name="check" strokeWidth={3} /> {summary.ok}</strong></span>
            <span className="w-wrong-txt"><strong><Icon name="wrong" strokeWidth={3} /> {summary.wrong}</strong></span>
            <span className="muted">/ {summary.total} mots</span>
            <span className="voice-bar-actions">
              {speech.listening ? (
                <button className="btn voice-on" onClick={stopVoice}><Icon name="stop" filled /> Terminer</button>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={() => startVoice(cfg.from, cfg.to)}><Icon name="restart" /> Recommencer</button>
                  <button className="btn" onClick={() => setCfg(null)}>Fermer</button>
                </>
              )}
            </span>
          </div>
          <div className="progress-track small"><div className="progress-fill" style={{ width: `${summary.total ? ((summary.ok + summary.wrong) / summary.total) * 100 : 0}%` }} /></div>
          {speech.error ? (
            <div className="voice-error">{speech.error}</div>
          ) : (
            !speech.listening && summary.ok + summary.wrong === 0 && <div>Aucune parole détectée. Appuyez sur « Recommencer » et parlez près du micro.</div>
          )}
          {!speech.listening && summary.total > 0 && summary.ok === summary.total && <div className="voice-perfect"><Icon name="check" strokeWidth={3} /> Bravo, récitation sans faute ({summary.total} mots).</div>}
          {heard && (
            <div className="voice-heard">
              Entendu : <bdi lang="ar" dir="rtl">{heard}</bdi>
            </div>
          )}
          <div className="voice-hint">
            Touchez un mot pour reprendre à partir de celui-ci. Vérifie les mots récités, pas les voyelles ni le tajwid.
            {isStandaloneIOS() && ' Sur iPhone/iPad, la reconnaissance vocale peut ne pas marcher depuis l’écran d’accueil : ouvrez l’app dans Safari.'}
          </div>
        </div>
      )}
      <TajweedSheet
        target={sheet}
        onClose={() => setSheet(null)}
        reciter={reciter}
        fallback={refReciter}
        surahNames={meta.surahs.map((s) => s.fr)}
        onBeforePlay={stopForSheet}
      />
    </main>
  );
}

interface BlockProps {
  verse: Verse;
  quarter?: Quarter;
  enriched?: Enriched;
  collapse: { n: number; open: boolean };
  stat?: VerseStat;
  playing: boolean;
  /** Statuts des mots de ce verset ; défini seulement si le verset fait partie de la récitation en cours. */
  slice?: WordStatus[];
  listening: boolean;
  voiceSupported: boolean;
  onPlay: (n: number) => void;
  onRepeat: (n: number) => void;
  mark?: VerseMark;
  vkey: string;
  onFlag: (key: string, flag: Flag) => void;
  onNote: (key: string, text: string) => void;
  onVoiceStart: (n: number) => void;
  onVoiceStop: () => void;
  onWordTap: (n: number, idx: number) => void;
  /** Fragments colorés du verset (mode « Tajwid en couleur ») et ouverture de la fiche d'un mot. */
  tj?: Fragment[];
  onTajweed: (n: number, idx: number, start: number, end: number) => void;
}

const VerseBlock = memo(function VerseBlock(p: BlockProps) {
  const { verse: v, enriched: e, slice } = p;
  const marker = p.quarter ? markerFor(p.quarter.q) : null;
  const segments = useMemo(() => splitVerse(v.ar), [v.ar]);
  // Chaque mot découpé en morceaux (texte, règle) ; null pour les signes de pause
  const tjWords = useMemo(() => (p.tj ? segments.map((s) => (s.idx == null ? null : wordPieces(v.ar, s.start, s.start + s.text.length, p.tj!))) : null), [p.tj, segments, v.ar]);

  return (
    <>
      {marker && (
        <div className={`hizb-marker ${marker.isHizbStart ? 'hizb-start' : ''}`} role="separator" aria-label={marker.fr}>
          <span className="hizb-symbol" aria-hidden="true">{marker.isHizbStart ? '۞' : <Icon name="dot" size="1.6em" strokeWidth={3} />}</span>
          <span className="hizb-ar" lang="ar" dir="rtl">{marker.ar}</span>
          <span className="hizb-fr">
            {marker.fr} · Juz {p.quarter!.juz} · p. {p.quarter!.page}
          </span>
        </div>
      )}
      <article className={`verse-card ${p.playing ? 'playing' : ''}`} id={`v-${v.n}`}>
        <div className="verse-top-row">
          <div className="verse-number-badge">{v.n}</div>
          <div className="verse-actions">
            {p.stat && (
              <span className="verse-stat" title={`${p.stat.attempts} essai(s), ${p.stat.perfect} sans faute`}>
                {p.stat.perfect > 0 && <Icon name="check" size="1em" strokeWidth={3} />} {p.stat.perfect}/{p.stat.attempts}
              </span>
            )}
            <button className="verse-play-btn" onClick={() => p.onPlay(v.n)}><Icon name="play" filled /> Écouter</button>
            <button className="verse-play-btn" onClick={() => p.onRepeat(v.n)} title="Répéter ce verset avec le récitateur (module Hifz)"><Icon name="repeat" /> Répéter</button>
            {p.listening ? (
              <button className="verse-play-btn voice-on" onClick={p.onVoiceStop}><Icon name="stop" filled /> Terminer</button>
            ) : (
              <button
                className="verse-play-btn voice-btn"
                onClick={() => p.onVoiceStart(v.n)}
                disabled={!p.voiceSupported}
                title={p.voiceSupported ? 'Réciter ce verset à voix haute' : 'Reconnaissance vocale indisponible sur ce navigateur'}
              >
                <Icon name="mic" /> Réciter
              </button>
            )}
          </div>
        </div>

        <VerseMarks vkey={p.vkey} mark={p.mark} onFlag={p.onFlag} onNote={p.onNote} />

        <div className="arabic-text" lang="ar" dir="rtl">
          {segments.map((s, i) => {
            const st = slice && s.idx != null ? slice[s.idx] : undefined;
            const color = st && st !== 'pending' ? `w-${st}` : '';
            // Les mots ne sont touchables que dans la récitation en cours (pas d'appui accidentel en faisant défiler)
            if (slice && s.idx != null) {
              const idx = s.idx;
              return (
                <span
                  key={i}
                  className={`${color} w-tap`.trim()}
                  data-w={idx}
                  role="button"
                  tabIndex={0}
                  aria-label={`Reprendre à partir du mot ${idx + 1} du verset ${v.n}`}
                  onClick={() => p.onWordTap(v.n, idx)}
                  onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), p.onWordTap(v.n, idx))}
                >
                  {s.text}{' '}
                </span>
              );
            }
            // Tajwid en couleur : un mot qui contient une règle est touchable et ouvre sa fiche
            const pieces = tjWords?.[i];
            if (pieces && pieces.some((pc) => pc.rule >= 0)) {
              const idx = s.idx as number;
              const open = () => p.onTajweed(v.n, idx, s.start, s.start + s.text.length);
              return (
                <span
                  key={i}
                  className="tj-word"
                  role="button"
                  tabIndex={0}
                  aria-label={`Règles de Tajwid du mot ${idx + 1} du verset ${v.n}`}
                  onClick={open}
                  onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), open())}
                >
                  {pieces.map((pc, k) => (pc.rule >= 0 ? <span key={k} className={`tj tj-${TAJWEED_CODES[pc.rule].replace(/_/g, '-')}`}>{pc.text}</span> : pc.text))}{' '}
                </span>
              );
            }
            return (
              <span key={i} className={color || undefined}>
                {s.text}{' '}
              </span>
            );
          })}
          {v.sajda === 1 && <span className="sajda" title="Prosternation de récitation">۩</span>}
        </div>

        {e ? (
          <>
            <div className="translit-block">
              <div className="translit-label">Translittération phonétique (Darija 3, 7, 9)</div>
              <div dangerouslySetInnerHTML={{ __html: e.translit }} />
            </div>
            <Fold title={<><Icon name="idea" /> Levier Darija (racines communes)</>} cls="darija-lever-box" collapse={p.collapse} defaultOpen>
              <div className="darija-lever-content" dangerouslySetInnerHTML={{ __html: e.darija }} />
            </Fold>
            <Fold title={<><Icon name="target" /> Conseil Tajwid pour darijophone</>} cls="tajwid-tip-box" collapse={p.collapse}>
              <div className="tajwid-tip-content" dangerouslySetInnerHTML={{ __html: e.tajwid }} />
            </Fold>
          </>
        ) : null}
        <Fold title={<><Icon name="translate" /> Traduction en français</>} cls="translation-box" collapse={p.collapse}>
          <div>{v.fr}</div>
        </Fold>
        {!e && (
          <div className="not-enriched">Levier Darija, translittération et conseils Tajwid : pas encore rédigés pour cette sourate.</div>
        )}
      </article>
    </>
  );
});

function Fold(props: { title: React.ReactNode; cls: string; collapse: { n: number; open: boolean }; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!props.defaultOpen);
  useEffect(() => {
    if (props.collapse.n > 0) setOpen(props.collapse.open);
  }, [props.collapse]);
  return (
    <div className={`collapsible-box ${props.cls} ${open ? '' : 'collapsed'}`}>
      <button className="collapsible-trigger" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="collapsible-trigger-title">{props.title}</span>
        <span className="collapsible-arrow"><Icon name="chevron" /></span>
      </button>
      <div className="collapsible-content">{props.children}</div>
    </div>
  );
}
