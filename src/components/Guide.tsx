import { useState } from 'react';
import type { Meta, Reciter } from '../types';
import Icon from './Icon';
import TajweedSheet, { type SheetTarget } from './TajweedSheet';
import { FAMILY_LABEL, RULES, ruleColorVar } from '../content/tajweedRules';

const FAMILIES = [...new Set(RULES.map((r) => r.family))];

const LETTERS: { code: string; ar: string; name: string; text: string }[] = [
  { code: '3', ar: 'ع', name: "'Ayn", text: 'Son pharyngé profond produit au milieu de la gorge (ex : 3ayn, 3sel, Rabbi l-3âlamîn).' },
  { code: '7', ar: 'ح', name: 'Ḥā’', text: 'H aspiré rauque et chaud, sans racler (ex : 7outa, l-7amd, Ar-Ra7mân). À distinguer du هـ doux.' },
  { code: '9', ar: 'ق', name: 'Qāf', text: "Son guttural lourd au fond du palais (ex : 9alb, 9ahwa, Al-Fala9). Ne pas le prononcer « G » !" },
  { code: '5 ou kh', ar: 'خ', name: 'Khā’', text: 'Son raclé au fond du palais, comme la « jota » espagnole (ex : 5obz, 5ala9a).' },
  { code: '8 ou gh', ar: 'غ', name: 'Ghayn', text: "R guttural proche d'un R français profond (ex : 8aba, ghayr, Al-Maghrib)." },
  { code: 'th', ar: 'ث', name: 'Thā’', text: "Interdentale : bout de la langue entre les dents (comme « think »). Souvent aplatie en T en Darija (tleta au lieu de thalatha)." },
  { code: 'dh', ar: 'ذ', name: 'Dhāl', text: "Interdentale sonore (comme « the »). Souvent aplatie en D en Darija." },
];

const PITFALLS: { title: string; text: string }[] = [
  {
    title: '1. La voyelle courte escamotée',
    text: "En Darija, les voyelles courtes sautent souvent (ktab au lieu de ki-tâ-bun). En récitation, chaque fatha, kasra et damma doit durer une pulsation pleine : ne transformez pas une voyelle brève en soukoun.",
  },
  {
    title: '2. Le Qaf (ق) confondu avec le G ou la Hamza',
    text: "Dans plusieurs dialectes, le Qaf s'adoucit en G ou en Hamza. En récitation, il doit sortir de son point d'articulation (le voile du palais). Avec un soukoun, faites rebondir la consonne (Qalqala).",
  },
  {
    title: '3. Les interdentales (ث ذ ظ) aplaties',
    text: "Le Darija les remplace souvent par T et D. Sur « al-ladhîna » ou « hadha », placez consciemment le bout de la langue entre les incisives.",
  },
  {
    title: "4. L'équilibre des allongements (Madd)",
    text: "Ne confondez pas voyelle courte (1 temps) et voyelle longue (Alif, Waw, Ya : 2 temps minimum). Gardez un rythme intérieur régulier.",
  },
];

export default function Guide({ meta, reciter }: { meta: Meta; reciter: Reciter }) {
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const fallback = meta.reciters.find((r) => r.id === 'alafasy') ?? reciter;
  return (
    <section className="tab-content fade-in">
      <div className="guide-card">
        <h2 className="guide-title"><Icon name="book" /> Le système des chiffres arabes (3, 7, 9, 5, 8)</h2>
        <p className="muted">
          Utilisé dans l&apos;écriture du Darija (« Arabizi »), il permet de transcrire les sons du Coran absents de l&apos;alphabet latin. Cette convention est
          employée partout dans l&apos;application.
        </p>
        <div className="table-scroll">
          <table className="phonetic-table">
            <thead>
              <tr><th>Chiffre</th><th>Lettre</th><th>Nom</th><th>Prononciation et exemples</th></tr>
            </thead>
            <tbody>
              {LETTERS.map((l) => (
                <tr key={l.ar}>
                  <td><span className="char-code">{l.code}</span></td>
                  <td className="ar-cell" lang="ar">{l.ar}</td>
                  <td>{l.name}</td>
                  <td>{l.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="guide-title spaced"><Icon name="target" /> Les 4 pièges majeurs pour les locuteurs de Darija</h3>
        <div className="pitfall-list">
          {PITFALLS.map((p) => (
            <div key={p.title} className="pitfall-item">
              <h4>{p.title}</h4>
              <p>{p.text}</p>
            </div>
          ))}
        </div>

        <h3 className="guide-title spaced"><Icon name="tajweed" /> Les règles du Tajwid</h3>
        <p className="muted">
          Touchez une règle pour la comprendre, l&apos;entendre dans la bouche d&apos;un récitant et voir comment la prononcer. Dans l&apos;onglet Récitation, le bouton
          « Tajwid en couleur » colore ces règles dans le texte : touchez alors n&apos;importe quel mot coloré pour ouvrir sa fiche.
        </p>
        {FAMILIES.map((f) => (
          <div key={f}>
            <h4 className="tj-family">{FAMILY_LABEL[f]}</h4>
            <div className="tj-rule-list">
              {RULES.filter((r) => r.family === f).map((r) => (
                <button key={r.code} className="tj-rule-row" onClick={() => setSheet({ kind: 'rule', code: r.code })}>
                  <span className="tj-dot big" style={{ background: ruleColorVar(r.code), marginTop: 0 }} aria-hidden="true" />
                  <span className="tj-name">{r.fr}</span>
                  <span className="tj-ar" lang="ar" dir="rtl">{r.ar}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <h3 className="guide-title spaced"><Icon name="mic" /> La récitation vocale</h3>
        <div className="pitfall-item">
          <p>
            Le bouton « Réciter » écoute votre voix et colore chaque mot : <span className="w-ok">vert</span> s&apos;il est reconnu,{' '}
            <span className="w-wrong">rouge</span> s&apos;il est faux ou sauté. La reconnaissance compare les <strong>mots</strong> (les consonnes), pas les
            voyelles brèves ni les règles de tajwid : elle vous aide à vérifier que vous connaissez le texte, elle ne remplace pas un professeur.
          </p>
        </div>
      </div>
      <TajweedSheet target={sheet} onClose={() => setSheet(null)} reciter={reciter} fallback={fallback} surahNames={meta.surahs.map((s) => s.fr)} />
    </section>
  );
}
