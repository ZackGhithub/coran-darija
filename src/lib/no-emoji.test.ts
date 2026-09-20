import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Garde-fou : l'interface n'utilise aucun emoji ni symbole-icône (▶ ✓ ♥ ⏸…). Les icônes passent par le composant
 * <Icon> (bibliothèque Lucide), qui suit la couleur du texte, le mode sombre et la taille de la police.
 *
 * Autorisés : ۞ et ۩ (signes du texte coranique), × (« 3× »), … et la ponctuation typographique.
 * Écrit avec des échappements pour ne contenir lui-même aucun de ces caractères.
 */
const FORBIDDEN = new RegExp(
  '[\\p{Extended_Pictographic}' + // tous les emojis
    '\\u2713\\u2714\\u2717\\u2718' + // ✓ ✔ ✗ ✘
    '\\u2190-\\u2193\\u21BB' + // flèches ← ↑ → ↓ et ↻
    '\\u25B2\\u25BC\\u25CF\\u25CB\\u25E6' + // ▲ ▼ ● ○ ◦
    '\\u2610\\u2611\\u2661\\u2665' + // ☐ ☑ ♡ ♥
    '\\u23EE\\u23ED\\u23F8\\u23F9\\u23F1' + // ⏮ ⏭ ⏸ ⏹ ⏱
    '\\u2705\\u2B06\\u2B07' + // ✅ ⬆ ⬇
    '\\u{1F1E6}-\\u{1F1FF}]', // drapeaux
  'u',
);

const ROOT = join(__dirname, '..', '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

/** Retire les commentaires : ils peuvent citer un symbole sans que l'interface l'affiche. */
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const files = [
  ...walk(join(ROOT, 'src')).filter((f) => /\.(tsx?|css)$/.test(f) && !/(legacy\.css|\.test\.ts)$/.test(f)),
  join(ROOT, 'index.html'),
  join(ROOT, 'data', 'enriched.seed.json'),
];

describe("aucun emoji dans l'interface", () => {
  it('a bien des fichiers à contrôler', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  for (const file of files) {
    it(file.replace(ROOT, '').replace(/^[\\/]/, ''), () => {
      const found = [...stripComments(readFileSync(file, 'utf8'))].filter((c) => FORBIDDEN.test(c));
      expect(found, `emoji ou symbole-icône trouvé : utilisez <Icon name="…" />`).toEqual([]);
    });
  }

  it('le contrôle détecte bien un emoji (le test de garde ne passe pas à vide)', () => {
    for (const bad of ['▶', '⏸', '♥', '✓', '→', '\u{1F600}', '\u{1F1EB}\u{1F1F7}']) expect(FORBIDDEN.test(bad), bad).toBe(true);
    for (const ok of ['۞', '۩', '×', '…', '·', '«', '∞']) expect(FORBIDDEN.test(ok), ok).toBe(false);
  });
});
