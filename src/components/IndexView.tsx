import { useMemo, useState } from 'react';
import type { Meta } from '../types';
import { hizbRangeOfSurah } from '../lib/hizb';

type Filter = 'all' | 'small' | 'learned' | 'unlearned' | 'makkah' | 'madinah';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'small', label: 'Petites sourates' },
  { id: 'all', label: 'Toutes (114)' },
  { id: 'learned', label: 'Apprises 🟢' },
  { id: 'unlearned', label: 'À apprendre ⚪' },
  { id: 'makkah', label: 'Mecquoises' },
  { id: 'madinah', label: 'Médinoises' },
];

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export default function IndexView({ meta, learned, onOpen }: { meta: Meta; learned: number[]; onOpen: (n: number) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const ranges = useMemo(() => meta.surahs.map((s) => hizbRangeOfSurah(meta.quarters, s.n, s.verses)), [meta]);

  const list = meta.surahs.filter((s) => {
    const isLearned = learned.includes(s.n);
    if (filter === 'small' && s.verses > 11 && s.n !== 1) return false;
    if (filter === 'learned' && !isLearned) return false;
    if (filter === 'unlearned' && isLearned) return false;
    if (filter === 'makkah' && s.type !== 'Mecquoise') return false;
    if (filter === 'madinah' && s.type !== 'Médinoise') return false;
    const q = fold(query.trim());
    if (!q) return true;
    return String(s.n) === q || fold(s.fr).includes(q) || fold(s.tr).includes(q) || s.ar.includes(query.trim());
  });

  return (
    <section className="tab-content fade-in">
      <input className="search-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher : numéro, nom (Fatiha) ou arabe (الناس)…" aria-label="Rechercher une sourate" />
      <div className="filter-pills">
        {FILTERS.map((f) => (
          <button key={f.id} className={`filter-pill ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>
      <div className="surah-grid">
        {list.length === 0 && <div className="empty">Aucune sourate ne correspond.</div>}
        {list.map((s) => {
          const r = ranges[s.n - 1];
          return (
            <button key={s.n} className="surah-grid-card" onClick={() => onOpen(s.n)}>
              <span className="surah-grid-left">
                <span className="surah-num">{s.n}</span>
                <span className="surah-info">
                  <h3>{s.fr}</h3>
                  <p>{s.tr} • {s.verses} v. • {r.from === r.to ? `Hizb ${r.from}` : `Hizb ${r.from}–${r.to}`}</p>
                </span>
              </span>
              <span className="surah-grid-right">
                <span className="surah-ar-name" lang="ar" dir="rtl">{s.ar}</span>
                <span className={`status-dot ${learned.includes(s.n) ? 'learned' : 'unlearned'}`} aria-label={learned.includes(s.n) ? 'apprise' : 'non apprise'} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
