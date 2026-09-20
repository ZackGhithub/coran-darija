import { useCallback, useEffect, useRef, useState } from 'react';
import type { Meta, Tab } from './types';
import { loadMeta } from './lib/data';
import { QUARTER_COUNT, quartersOfHizb } from './lib/hizb';
import { exportProgress, importProgress, usePersisted, type VerseStat } from './lib/storage';
import Recitation from './components/Recitation';
import IndexView from './components/IndexView';
import HizbView from './components/HizbView';
import Guide from './components/Guide';
import Quiz from './components/Quiz';

const TABS: { id: Tab; label: string }[] = [
  { id: 'recitation', label: 'Récitation' },
  { id: 'index', label: 'Sourates' },
  { id: 'hizb', label: 'Hizb' },
  { id: 'guide', label: 'Guide' },
  { id: 'quiz', label: 'Quiz' },
];

type Theme = 'system' | 'light' | 'dark';

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState(false);
  const [tab, setTab] = useState<Tab>('recitation');
  const [surah, setSurah] = usePersisted<number>('surah', 112);
  const [focusVerse, setFocusVerse] = useState<number | null>(null);
  const [learned, setLearned] = usePersisted<number[]>('learned', []);
  const [quarters, setQuarters] = usePersisted<number[]>('quarters', []);
  const [verseStats, setVerseStats] = usePersisted<Record<string, VerseStat>>('verseStats', {});
  const [theme, setTheme] = usePersisted<Theme>('theme', 'system');
  const [fontSize, setFontSize] = usePersisted<number>('fontSize', 1.75);
  const [reciterId, setReciterId] = usePersisted<string>('reciter', 'alafasy');
  const [repeat, setRepeat] = usePersisted<1 | 3 | 5>('repeat', 1);
  const [toast, setToast] = useState<string | null>(null);
  const [showTop, setShowTop] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    loadMeta().then(setMeta).catch(() => setMetaError(true));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--arabic-font-size', `${fontSize}rem`);
  }, [fontSize]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openSurah = useCallback(
    (n: number, verse: number | null = null) => {
      setSurah(n);
      setFocusVerse(verse);
      setTab('recitation');
      if (verse == null) window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setSurah],
  );

  const toggle = (list: number[], n: number) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n].sort((a, b) => a - b));

  const onExport = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'coran-darija-progression.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      importProgress(await file.text());
      setToast('Progression importée, rechargement…');
      setTimeout(() => location.reload(), 900);
    } catch {
      setToast("Import impossible : ce fichier n'est pas une sauvegarde de l'application.");
    }
  };

  if (metaError) {
    return (
      <div className="app-container">
        <div className="notice notice-error">
          Impossible de charger les données. Vérifiez votre connexion puis <button className="link-btn" onClick={() => location.reload()}>rechargez la page</button>.
        </div>
      </div>
    );
  }
  if (!meta) return <div className="app-container"><div className="loading">Chargement…</div></div>;

  const pct = Math.round((learned.length / meta.surahs.length) * 100);
  const cycleTheme = () => setTheme(theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system');

  return (
    <div className="app-container">
      <header className="header-bar">
        <div className="brand-group">
          <div className="brand-icon" aria-hidden="true">ق</div>
          <div className="brand-text">
            <h1>Coran Darija</h1>
            <p>Passerelle du Darija vers le Coran et le Tajwid</p>
          </div>
        </div>
        <div className="header-controls">
          <button className="btn" onClick={cycleTheme} aria-label="Changer de thème">
            {theme === 'dark' ? '☀️ Clair' : theme === 'light' ? '🌗 Auto' : '🌙 Sombre'}
          </button>
        </div>
      </header>

      <section className="progress-card">
        <div className="progress-meta">
          <div className="progress-title"><span className="status-dot learned" /><span>Suivi des 114 sourates</span></div>
          <div className="progress-count">{learned.length} / 114 apprises ({pct}%) · {quarters.length} / {QUARTER_COUNT} quarts de Hizb</div>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
      </section>

      <nav className="tabs-nav" role="tablist" aria-label="Navigation principale">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'recitation' && (
        <Recitation
          meta={meta}
          surahNum={surah}
          onSurah={(n) => openSurah(n)}
          focusVerse={focusVerse}
          learned={learned}
          onToggleLearned={(n) => setLearned((l) => toggle(l, n))}
          fontSize={fontSize}
          onFontSize={setFontSize}
          reciterId={reciterId}
          onReciter={setReciterId}
          repeat={repeat}
          onRepeat={setRepeat}
          verseStats={verseStats}
          onVerseStat={(k, s) => setVerseStats((p) => ({ ...p, [k]: s }))}
        />
      )}
      {tab === 'index' && <IndexView meta={meta} learned={learned} onOpen={(n) => openSurah(n)} />}
      {tab === 'hizb' && (
        <HizbView
          meta={meta}
          done={quarters}
          onToggle={(q) => setQuarters((l) => toggle(l, q))}
          onToggleHizb={(h, allDone) =>
            setQuarters((l) => {
              const qs = quartersOfHizb(h);
              return allDone ? l.filter((x) => !qs.includes(x)) : [...new Set([...l, ...qs])].sort((a, b) => a - b);
            })
          }
          onOpen={(s, a) => openSurah(s, a)}
        />
      )}
      {tab === 'guide' && <Guide />}
      {tab === 'quiz' && <Quiz />}

      <footer>
        <p>Coran Darija — pour l&apos;apprentissage autonome et la mémorisation sereine.</p>
        <p className="foot-small">Votre progression reste sur cet appareil. Sauvegardez-la pour la retrouver sur un autre appareil :</p>
        <p className="foot-actions">
          <button className="btn-action-compact" onClick={onExport}>⬇ Exporter</button>
          <button className="btn-action-compact" onClick={() => fileInput.current?.click()}>⬆ Importer</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ''; }} />
        </p>
        <p className="foot-small">Texte : Tanzil · Traduction : Hamidullah · Audio : everyayah.com</p>
      </footer>

      {showTop && (
        <button className="top-btn" aria-label="Retour en haut de la page" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          ↑
        </button>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
