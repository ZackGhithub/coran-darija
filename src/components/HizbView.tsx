import { useMemo, useState } from 'react';
import type { Meta } from '../types';
import Icon from './Icon';
import { HIZB_COUNT, QUARTER_COUNT, completeHizb, doneQuarters, isQuarterDone, juzOfHizb, markerFor, quartersOfHizb, type QuarterProgress } from '../lib/hizb';

interface Props {
  meta: Meta;
  /** Avancement de chaque quart (indice q-1), calculé à partir des versets cochés « mémorisé ». */
  progress: QuarterProgress[];
  onToggle: (q: number) => void;
  onToggleHizb: (hizb: number) => void;
  onOpen: (surah: number, ayah: number) => void;
}

/**
 * Marquage par Hizb : chaque Hizb a 4 quarts. Cocher un quart coche tous ses versets « mémorisé » (et l'inverse) :
 * la progression du Hifz et celle des Hizb viennent de la même donnée, il n'y a rien à synchroniser.
 */
export default function HizbView({ meta, progress, onToggle, onToggleHizb, onOpen }: Props) {
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const hizbs = Array.from({ length: HIZB_COUNT }, (_, i) => i + 1);
  const doneCount = useMemo(() => doneQuarters(progress).length, [progress]);
  const fullHizb = useMemo(() => completeHizb(progress), [progress]);
  const doneIn = (h: number) => quartersOfHizb(h).filter((q) => isQuarterDone(progress[q - 1])).length;
  const shown = hizbs.filter((h) => {
    const n = doneIn(h);
    return filter === 'all' || (filter === 'done' ? n === 4 : n < 4);
  });

  return (
    <section className="tab-content fade-in">
      <div className="guide-card hizb-summary">
        <h2 className="guide-title">۞ Marquage par Hizb</h2>
        <p className="muted">
          Le Coran se divise en 60 Hizb (2 par Juz), chacun en 4 quarts. Cocher un quart marque <strong>tous ses versets comme mémorisés</strong> : ils sont
          comptés dans « Ma mémorisation » (onglet Hifz) et dans vos sourates complètes. À l&apos;inverse, un quart dont tous les versets sont mémorisés se
          coche tout seul. Touchez « Lire » pour ouvrir le texte à cet endroit.
        </p>
        <div className="hizb-totals">
          <strong>{doneCount} / {QUARTER_COUNT}</strong> quarts · <strong>{fullHizb} / {HIZB_COUNT}</strong> Hizb complets
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${(doneCount / QUARTER_COUNT) * 100}%` }} /></div>
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
          const n = doneIn(h);
          return (
            <div key={h} className={`hizb-card ${n === 4 ? 'complete' : ''}`}>
              <div className="hizb-card-head">
                <div>
                  <h3><span aria-hidden="true">۞</span> Hizb {h} <span lang="ar" dir="rtl" className="hizb-head-ar">الحزب {h}</span></h3>
                  <p className="muted">Juz {juzOfHizb(h)}</p>
                </div>
                <button className="btn-action-compact" onClick={() => onToggleHizb(h)}>
                  {n === 4 ? 'Décocher' : 'Tout cocher'}
                </button>
              </div>
              <ul className="quarter-list">
                {qs.map((q) => {
                  const info = meta.quarters[q - 1];
                  const s = meta.surahs[info.surah - 1];
                  const pr = progress[q - 1];
                  const on = isQuarterDone(pr);
                  const partial = !on && !!pr && pr.done > 0;
                  return (
                    <li key={q} className="quarter-row">
                      <button
                        className={`quarter-check ${on ? 'on' : ''} ${partial ? 'partial' : ''}`}
                        onClick={() => onToggle(q)}
                        aria-pressed={on ? true : partial ? 'mixed' : false}
                        aria-label={`${markerFor(q).fr}, ${on ? 'fait' : partial ? `en cours, ${pr.done} versets sur ${pr.total}` : 'à faire'}`}
                      >
                        {on ? <Icon name="check" size="1em" strokeWidth={3} /> : partial ? <Icon name="minus" size="1em" strokeWidth={3} /> : null}
                      </button>
                      <span className="quarter-text">
                        <strong>{markerFor(q).part === 0 ? 'Début' : ['', '¼', '½', '¾'][markerFor(q).part]}</strong>
                        <span className="muted"> · {s.fr} {info.ayah} · p. {info.page}</span>
                        {pr && <span className="muted quarter-count"> · {pr.done}/{pr.total} v.</span>}
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
