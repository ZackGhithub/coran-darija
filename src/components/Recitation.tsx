import { useEffect, useMemo, useRef, useState } from 'react';
import type { Enriched, Meta, Quarter, Verse } from '../types';
import { getEnriched, loadSurah } from '../lib/data';
import { alignRecitation, splitVerse, summarize, tokenizeSpoken, tokenizeVerse, type WordStatus } from '../lib/arabic';
import { hizbRangeOfSurah, indexQuarters, markerFor, quarterKey } from '../lib/hizb';
import type { VerseStat } from '../lib/storage';
import { useAudio } from '../hooks/useAudio';
import { isStandaloneIOS, useSpeech } from '../hooks/useSpeech';

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
  verseStats: Record<string, VerseStat>;
  onVerseStat: (key: string, stat: VerseStat) => void;
}

const STYLE_LABEL = { murattal: 'Murattal', mujawwad: 'Mujawwad', muallim: 'Pédagogique' } as const;

export default function Recitation(p: Props) {
  const { meta, surahNum } = p;
  const surah = meta.surahs[surahNum - 1];
  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collapse, setCollapse] = useState<{ n: number; open: boolean }>({ n: 0, open: false });
  const [voiceVerse, setVoiceVerse] = useState<number | null>(null);
  const wasListening = useRef(false);

  const reciter = meta.reciters.find((r) => r.id === p.reciterId) ?? meta.reciters[0];
  const audio = useAudio(reciter, p.repeat);
  const speech = useSpeech('ar-SA');
  const quarterIdx = useMemo(() => indexQuarters(meta.quarters), [meta.quarters]);
  const enriched = useMemo(() => getEnriched(surahNum), [surahNum]);
  const hizb = useMemo(() => hizbRangeOfSurah(meta.quarters, surahNum, surah.verses), [meta.quarters, surahNum, surah.verses]);

  useEffect(() => {
    let alive = true;
    setVerses(null);
    setLoadError(null);
    setVoiceVerse(null);
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

  const activeVerse = verses?.find((v) => v.n === voiceVerse) ?? null;
  const statuses: WordStatus[] = useMemo(() => {
    if (!activeVerse) return [];
    return alignRecitation(tokenizeVerse(activeVerse.ar), tokenizeSpoken(speech.transcript), { provisionalLast: speech.interim });
  }, [activeVerse, speech.transcript, speech.interim]);
  const summary = summarize(statuses);

  // Récitation parfaite : on arrête le micro tout seul
  useEffect(() => {
    if (summary.perfect && speech.listening) speech.stop();
  }, [summary.perfect, speech.listening, speech.stop]);

  // Fin d'écoute : on enregistre le résultat du verset. Court délai : le moteur peut encore rendre les derniers mots
  // après « Terminer ». On lit alors les valeurs les plus récentes via une référence.
  const latest = useRef({ summary, verse: activeVerse, stats: p.verseStats });
  latest.current = { summary, verse: activeVerse, stats: p.verseStats };
  useEffect(() => {
    if (speech.listening) {
      wasListening.current = true;
      return;
    }
    if (!wasListening.current) return;
    wasListening.current = false;
    window.setTimeout(() => {
      const { summary: s, verse, stats } = latest.current;
      if (!verse || s.ok + s.wrong === 0) return;
      const key = quarterKey(surahNum, verse.n);
      const prev = stats[key];
      p.onVerseStat(key, {
        attempts: (prev?.attempts ?? 0) + 1,
        perfect: (prev?.perfect ?? 0) + (s.perfect ? 1 : 0),
        bestOk: Math.max(prev?.bestOk ?? 0, s.ok),
        total: s.total,
        last: Date.now(),
      });
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.listening]);

  const startVoice = (n: number) => {
    audio.stop();
    setVoiceVerse(n);
    speech.start();
  };

  // Le micro ne doit pas « entendre » le récitateur : on coupe l'écoute avant de lancer l'audio.
  const playVerses = (verseNums: number[]) => {
    speech.stop();
    audio.playVerses(surahNum, verseNums);
  };

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

  return (
    <main className="tab-content fade-in">
      <div className="jump-bar">
        <select className="surah-select" value={surahNum} onChange={(e) => p.onSurah(Number(e.target.value))} aria-label="Choisir la sourate">
          {meta.surahs.map((s) => (
            <option key={s.n} value={s.n}>
              {p.learned.includes(s.n) ? '🟢' : '⚪'} {s.n}. {s.fr}
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
          {Array.from({ length: surah.verses }, (_, i) => i + 1).map((n) => (
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
          <span className="pill-badge">{hizb.from === hizb.to ? `Hizb ${hizb.from}` : `Hizb ${hizb.from} → ${hizb.to}`}</span>
          <button className={`pill-badge pill-btn ${isLearned ? 'is-learned' : ''}`} onClick={() => p.onToggleLearned(surahNum)} aria-pressed={isLearned}>
            {isLearned ? 'Mémorisée 🟢' : 'Marquer comme apprise ⚪'}
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
            <button className="btn" onClick={audio.stop}>⏹ Arrêter</button>
          ) : (
            <button className="btn btn-primary" disabled={!verses} onClick={() => verses && playVerses(verses.map((v) => v.n))}>
              ▶ Écouter la sourate
            </button>
          )}
          <button className="btn" onClick={() => p.onRepeat(p.repeat === 1 ? 3 : p.repeat === 3 ? 5 : 1)} title="Nombre de lectures de chaque verset">
            Boucle : {p.repeat}×
          </button>
        </div>
        <div className="font-group">
          <span className="font-label">Taille arabe :</span>
          <button className="btn btn-icon" aria-label="Réduire" onClick={() => p.onFontSize(Math.max(1.2, +(p.fontSize - 0.15).toFixed(2)))}>−</button>
          <button className="btn btn-icon" aria-label="Agrandir" onClick={() => p.onFontSize(Math.min(3, +(p.fontSize + 0.15).toFixed(2)))}>+</button>
          <button className="btn-action-compact" onClick={() => setCollapse((c) => ({ n: c.n + 1, open: false }))}>▲ Tout réduire</button>
          <button className="btn-action-compact" onClick={() => setCollapse((c) => ({ n: c.n + 1, open: true }))}>▼ Tout afficher</button>
        </div>
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
          surahNum={surahNum}
          verse={v}
          quarter={quarterIdx.get(quarterKey(surahNum, v.n))}
          enriched={enriched?.get(v.n)}
          fontSize={p.fontSize}
          playing={playingVerse === v.n}
          onPlay={() => playVerses([v.n])}
          collapse={collapse}
          stat={p.verseStats[quarterKey(surahNum, v.n)]}
          voice={
            voiceVerse === v.n
              ? { listening: speech.listening, statuses, summary, supported: speech.supported, error: speech.error, transcript: speech.transcript }
              : null
          }
          onVoiceStart={() => startVoice(v.n)}
          onVoiceStop={speech.stop}
          onVoiceReset={() => startVoice(v.n)}
          voiceSupported={speech.supported}
        />
      ))}
    </main>
  );
}

interface BlockProps {
  surahNum: number;
  verse: Verse;
  quarter?: Quarter;
  enriched?: Enriched;
  fontSize: number;
  playing: boolean;
  onPlay: () => void;
  collapse: { n: number; open: boolean };
  stat?: VerseStat;
  voice: {
    listening: boolean;
    statuses: WordStatus[];
    summary: ReturnType<typeof summarize>;
    supported: boolean;
    error: string | null;
    transcript: string;
  } | null;
  voiceSupported: boolean;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  onVoiceReset: () => void;
}

function VerseBlock(p: BlockProps) {
  const { verse: v, enriched: e, voice } = p;
  const marker = p.quarter ? markerFor(p.quarter.q) : null;
  const segments = useMemo(() => splitVerse(v.ar), [v.ar]);

  return (
    <>
      {marker && (
        <div className={`hizb-marker ${marker.isHizbStart ? 'hizb-start' : ''}`} role="separator" aria-label={marker.fr}>
          <span className="hizb-symbol" aria-hidden="true">{marker.symbol}</span>
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
                {p.stat.perfect > 0 ? '✓' : '·'} {p.stat.perfect}/{p.stat.attempts}
              </span>
            )}
            <button className="verse-play-btn" onClick={p.onPlay}>▶ Écouter</button>
            {voice?.listening ? (
              <button className="verse-play-btn voice-on" onClick={p.onVoiceStop}>⏹ Terminer</button>
            ) : (
              <button className="verse-play-btn voice-btn" onClick={p.onVoiceStart} disabled={!p.voiceSupported} title={p.voiceSupported ? 'Réciter ce verset à voix haute' : 'Reconnaissance vocale indisponible sur ce navigateur'}>
                🎤 Réciter
              </button>
            )}
          </div>
        </div>

        <div className="arabic-text" lang="ar" dir="rtl">
          {segments.map((s, i) => {
            const st = voice && s.idx != null ? voice.statuses[s.idx] : undefined;
            return (
              <span key={i} className={st && st !== 'pending' ? `w-${st}` : undefined}>
                {s.text}{' '}
              </span>
            );
          })}
          {v.sajda === 1 && <span className="sajda" title="Prosternation de récitation">۩</span>}
        </div>

        {voice && (
          <div className="voice-panel" role="status" aria-live="polite">
            {voice.error ? (
              <span className="voice-error">{voice.error}</span>
            ) : voice.listening ? (
              <span><span className="rec-dot" aria-hidden="true" /> Je vous écoute… récitez le verset.</span>
            ) : voice.summary.ok + voice.summary.wrong === 0 ? (
              <span>Aucune parole détectée. Appuyez sur « Réciter » et parlez près du micro.</span>
            ) : voice.summary.perfect ? (
              <span className="voice-perfect">✓ Bravo, verset récité sans faute ({voice.summary.total} mots).</span>
            ) : (
              <span>
                <strong className="w-ok-txt">{voice.summary.ok} juste(s)</strong> · <strong className="w-wrong-txt">{voice.summary.wrong} à revoir</strong>
                {voice.summary.pending > 0 && <> · {voice.summary.pending} non récité(s)</>}
              </span>
            )}
            {!voice.listening && (
              <button className="btn-action-compact" onClick={p.onVoiceReset}>↻ Recommencer</button>
            )}
            {voice.transcript && (
              <span className="voice-heard">
                Entendu : <bdi lang="ar" dir="rtl">{voice.transcript}</bdi>
              </span>
            )}
            <span className="voice-hint">Vérifie les mots récités, pas les voyelles ni le tajwid.</span>
            {isStandaloneIOS() && (
              <span className="voice-hint">Sur iPhone/iPad, la reconnaissance vocale peut ne pas marcher depuis l&apos;écran d&apos;accueil : ouvrez l&apos;app dans Safari.</span>
            )}
          </div>
        )}

        {e ? (
          <>
            <div className="translit-block">
              <div className="translit-label">Translittération phonétique (Darija 3, 7, 9)</div>
              <div dangerouslySetInnerHTML={{ __html: e.translit }} />
            </div>
            <Fold title="💡 Levier Darija (racines communes)" cls="darija-lever-box" collapse={p.collapse} defaultOpen>
              <div className="darija-lever-content" dangerouslySetInnerHTML={{ __html: e.darija }} />
            </Fold>
            <Fold title="🎯 Conseil Tajwid pour darijophone" cls="tajwid-tip-box" collapse={p.collapse}>
              <div className="tajwid-tip-content" dangerouslySetInnerHTML={{ __html: e.tajwid }} />
            </Fold>
          </>
        ) : null}
        <Fold title="🇫🇷 Traduction en français" cls="translation-box" collapse={p.collapse}>
          <div>{v.fr}</div>
        </Fold>
        {!e && (
          <div className="not-enriched">Levier Darija, translittération et conseils Tajwid : pas encore rédigés pour cette sourate.</div>
        )}
      </article>
    </>
  );
}

function Fold(props: { title: string; cls: string; collapse: { n: number; open: boolean }; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!props.defaultOpen);
  useEffect(() => {
    if (props.collapse.n > 0) setOpen(props.collapse.open);
  }, [props.collapse]);
  return (
    <div className={`collapsible-box ${props.cls} ${open ? '' : 'collapsed'}`}>
      <button className="collapsible-trigger" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="collapsible-trigger-title">{props.title}</span>
        <span className="collapsible-arrow">▼</span>
      </button>
      <div className="collapsible-content">{props.children}</div>
    </div>
  );
}
