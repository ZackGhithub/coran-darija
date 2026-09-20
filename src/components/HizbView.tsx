import { useMemo, useState } from 'react';
import type { Meta } from '../types';
import Icon from './Icon';
import { HIZB_COUNT, QUARTER_COUNT, juzOfHizb, markerFor, quartersOfHizb } from '../lib/hizb';

interface Props {
  meta: Meta;
  done: number[]; // quarts marqués comme mémorisés / révisés
  onToggle: (q: number) => void;
  onToggleHizb: (hizb: number, allDone: boolean) => void;
  onOpen: (surah: number, ayah: number) => void;
}

/** Marquage par Hizb : chaque Hizb a 4 quarts ; on coche ce qu'on a mémorisé et on saute au texte. */
export default function HizbView({ meta, done, onToggle, onToggleHizb, onOpen }: Props) {
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const doneSet = useMemo(() => new Set(done), [done]);
  const hizbs = Array.from({ length: HIZB_COUNT }, (_, i) => i + 1);
  const fullHizb = hizbs.filter((h) => quartersOfHizb(h).every((q) => doneSet.has(q))).length;
  const shown = hizbs.filter((h) => {
    const n = quartersOfHizb(h).filter((q) => doneSet.has(q)).length;
    return filter === 'all' || (filter === 'done' ? n === 4 : n < 4);
  });

  return (
    <section className="tab-content fade-in">
      <div className="guide-card hizb-summary">
        <h2 className="guide-title">۞ Marquage par Hizb</h2>
        <p className="muted">
          Le Coran se divise en 60 Hizb (2 par Juz), chacun en 4 quarts. Cochez les quarts que vous avez mémorisés ou révisés,
          et touchez « Lire » pour ouvrir le texte à cet endroit.
        </p>
        <div className="hizb-totals">
          <strong>{done.length} / {QUARTER_COUNT}</strong> quarts · <strong>{fullHizb} / {HIZB_COUNT}</strong> Hizb complets
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${(done.length / QUARTER_COUNT) * 100}%` }} /></div>
        <div className="filter-pills">
          {(['all', 'todo', 'done'] as const).map((f) => (
            <button key={f} className={`filter-pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'Tous (60)' : f === 'todo' ? 'À faire' : 'Complets'}
            </button>
          ))}
        </div>
      </div>

      <div className="hizb-grid">
        {shown.map((h) => {
          const qs = quartersOfHizb(h);
          const n = qs.filter((q) => doneSet.has(q)).length;
          return (
            <div key={h} className={`hizb-card ${n === 4 ? 'complete' : ''}`}>
              <div className="hizb-card-head">
                <div>
                  <h3><span aria-hidden="true">۞</span> Hizb {h} <span lang="ar" dir="rtl" className="hizb-head-ar">الحزب {h}</span></h3>
                  <p className="muted">Juz {juzOfHizb(h)}</p>
                </div>
                <button className="btn-action-compact" onClick={() => onToggleHizb(h, n === 4)}>
                  {n === 4 ? 'Décocher' : 'Tout cocher'}
                </button>
              </div>
              <ul className="quarter-list">
                {qs.map((q) => {
                  const info = meta.quarters[q - 1];
                  const s = meta.surahs[info.surah - 1];
                  const on = doneSet.has(q);
                  return (
                    <li key={q} className="quarter-row">
                      <button className={`quarter-check ${on ? 'on' : ''}`} onClick={() => onToggle(q)} aria-pressed={on} aria-label={`${markerFor(q).fr}, ${on ? 'fait' : 'à faire'}`}>
                        {on ? <Icon name="check" size="1em" strokeWidth={3} /> : null}
                      </button>
                      <span className="quarter-text">
                        <strong>{markerFor(q).part === 0 ? 'Début' : ['', '¼', '½', '¾'][markerFor(q).part]}</strong>
                        <span className="muted"> · {s.fr} {info.ayah} · p. {info.page}</span>
                      </span>
                      <button className="link-btn" onClick={() => onOpen(info.surah, info.ayah)}>Lire <Icon name="right" /></button>
                    </li>
                  );
                })}
              </ul>
              <div className="progress-track small"><div className="progress-fill" style={{ width: `${(n / 4) * 100}%` }} /></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
