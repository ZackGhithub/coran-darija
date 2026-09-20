#!/usr/bin/env node
/**
 * Contrôle de confidentialité : bloque tout ce qui ressemble à une information privée
 * avant qu'elle n'atteigne l'historique git ou le site publié.
 *
 * Modes (combinables) :
 *   --staged   fichiers indexés (pre-commit)              [défaut]
 *   --all      tous les fichiers suivis + non ignorés
 *   --dist     contenu du dossier dist/ (avant déploiement)
 *   --history  auteurs, e-mails et messages de tous les commits (pre-push)
 *
 * Termes personnels (noms, pseudo, e-mail...) : fichier local `.privacy-denylist`
 * (un terme par ligne, insensible à la casse). Il est ignoré par git : il ne quitte jamais ce poste.
 * La CI n'a pas ce fichier : elle applique les motifs génériques ci-dessous.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const args = new Set(process.argv.slice(2));
if (![...args].some((a) => ['--staged', '--all', '--dist', '--history'].includes(a))) args.add('--staged');

const ALLOWED_EMAILS = [/^noreply@users\.noreply\.github\.com$/i, /^\d+\+[\w-]+@users\.noreply\.github\.com$/i, /@example\.(com|org|invalid)$/i];
const SKIP_FILES = [/^package-lock\.json$/, /^\.privacy-denylist$/, /^scripts\/privacy-check\.mjs$/];
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|icns|woff2?|ttf|otf|mp3|mp4|zip|pdf|gz)$/i;

/** [nom, regex] : chaque motif est un signal fort d'information privée ou de secret. */
const PATTERNS = [
  ['adresse IP privée (LAN)', /\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/],
  ['adresse IP Tailscale (CGNAT)', /\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/],
  ['nom de machine Tailscale', /\b[\w-]+\.ts\.net\b/i],
  ['adresse MAC', /\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/i],
  ['chemin de profil Windows/Mac/Linux', /(?:[A-Za-z]:\\+Users\\+|\/Users\/|\/home\/)[\w.$~-]+/],
  ['jeton GitHub', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|github_pat_[A-Za-z0-9_]{20,}/],
  ['clé API Google/Gemini', /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['clé de type sk-', /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ['JWT / jeton long', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['clé privée', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['secret affecté', /\b(?:api[_-]?key|secret|token|passw(?:or)?d|pwd)\b\s*[:=]\s*["']?[A-Za-z0-9_\-./+]{8,}/i],
  ['identifiant WhatsApp', /\b\d{8,15}@(?:c|g)\.us\b/],
  ['numéro de téléphone', /(?:\+|00)\d{1,3}[ .-]?\d(?:[ .-]?\d{2}){4}\b|\b0[1-9](?:[ .-]?\d{2}){4}\b/],
  ['e-mail', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/],
];

const denylist = existsSync(join(ROOT, '.privacy-denylist'))
  ? readFileSync(join(ROOT, '.privacy-denylist'), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l && !l.startsWith('#'))
  : [];

const findings = [];
const report = (where, what, sample) => findings.push({ where, what, sample: sample.slice(0, 80) });

function scanText(where, text) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.length > 4000) return; // JSON minifié : traité par blocs ci-dessous
    scanLine(`${where}:${i + 1}`, line);
  });
  // Lignes très longues (data minifiée) : on scanne par tranches pour ne rien rater.
  lines.forEach((line, i) => {
    if (line.length <= 4000) return;
    for (let p = 0; p < line.length; p += 3000) scanLine(`${where}:${i + 1}`, line.slice(p, p + 3200));
  });
}

function scanLine(where, line) {
  for (const [name, re] of PATTERNS) {
    const m = line.match(re);
    if (!m) continue;
    if (name === 'e-mail' && ALLOWED_EMAILS.some((ok) => ok.test(m[0]))) continue;
    report(where, name, m[0]);
  }
  const lower = line.toLowerCase();
  for (const term of denylist) if (lower.includes(term)) report(where, 'terme personnel (.privacy-denylist)', '«' + term + '»');
}

function trackedFiles(mode) {
  const out =
    mode === 'staged'
      ? execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { cwd: ROOT, encoding: 'utf8' })
      : execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

function readStaged(file) {
  return execFileSync('git', ['show', `:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

function scanFiles(mode) {
  for (const file of trackedFiles(mode)) {
    const norm = file.split(sep).join('/');
    if (/(^|\/)\.env(\.|$)/.test(norm) && !/\.example$/.test(norm)) report(norm, 'fichier .env versionné', norm);
    if (/\.(pem|key|p12|pfx|zip)$/i.test(norm)) report(norm, 'fichier sensible/archive versionné', norm);
    if (SKIP_FILES.some((re) => re.test(norm)) || BINARY_EXT.test(norm)) continue;
    try {
      scanText(norm, mode === 'staged' ? readStaged(file) : readFileSync(join(ROOT, file), 'utf8'));
    } catch {
      /* fichier supprimé ou illisible : ignoré */
    }
  }
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function scanDist() {
  const dist = join(ROOT, 'dist');
  if (!existsSync(dist)) return report('dist/', 'dossier dist/ introuvable', 'lancez npm run build');
  for (const p of walk(dist)) {
    const rel = 'dist/' + relative(dist, p).split(sep).join('/');
    if (BINARY_EXT.test(p)) continue;
    scanText(rel, readFileSync(p, 'utf8'));
  }
}

function scanIdentity(withHistory) {
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
  for (const key of ['user.email', 'user.name']) {
    let v = '';
    try { v = git('config', key); } catch { /* non défini */ }
    if (!v) { report('git config', `${key} non défini`, 'définissez une identité neutre'); continue; }
    if (key === 'user.email' && !ALLOWED_EMAILS.some((ok) => ok.test(v))) report('git config', 'e-mail git personnel (serait public)', v);
    scanLine(`git config ${key}`, v);
  }
  if (!withHistory) return;
  let log = '';
  try { log = git('log', '--all', '--format=%an <%ae>|%cn <%ce>|%s%n%b%n--'); } catch { return; } // dépôt sans commit
  scanText('historique git', log);
}

if (args.has('--staged')) scanFiles('staged');
if (args.has('--all')) scanFiles('all');
if (args.has('--dist')) scanDist();
scanIdentity(args.has('--history')); // identité git courante toujours ; historique complet avec --history

const scope = [...args].join(' ');
if (findings.length) {
  console.error(`\n✖ Contrôle de confidentialité ÉCHOUÉ (${scope}) : ${findings.length} problème(s)\n`);
  for (const f of findings) console.error(`  - ${f.where}  [${f.what}]  ${f.sample}`);
  console.error('\nCorrigez ou retirez ces éléments. Rien n\'est envoyé tant que ce contrôle échoue.');
  process.exit(1);
}
console.log(`✔ Contrôle de confidentialité OK (${scope})` + (denylist.length ? '' : ' — attention : pas de .privacy-denylist local, seuls les motifs génériques sont appliqués'));
