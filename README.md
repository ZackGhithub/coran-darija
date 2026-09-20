# Coran Darija

Application web (PWA) pour apprendre à lire, réciter et mémoriser le Coran en s'appuyant sur le Darija :
translittération avec les chiffres 3-7-9, « leviers » de racines communes, conseils de Tajwid pour darijophones.

## Fonctionnalités

- **114 sourates** complètes (texte arabe, traduction française), lisibles **hors ligne** une fois l'app chargée.
- **Récitation vocale** : le bouton « Réciter » écoute la voix et colore chaque mot, **vert** si reconnu, **rouge** si faux ou sauté.
  La comparaison porte sur les mots (consonnes), pas sur les voyelles brèves ni le tajwid (limite des moteurs vocaux).
- **Récitation continue** : réciter un groupe de versets ou toute la sourate d'une traite (barre de suivi collée en bas, la page suit le verset en cours). Toucher un mot reprend à partir de celui-ci.
- **Mémorisation (Hifz)** : isoler un verset ou un groupe de versets et les faire répéter (chaque verset ×N, le groupe ×M ou sans fin), avec une pause pour répéter à voix haute, un **tempo réglable de 0,5× à 1,25×** (hauteur de la voix conservée) et un **surlignage du texte arabe et de la translittération au rythme de la voix**.
  Mode **« réciter de mémoire »** : à partir de la lecture n°N, le texte se masque (premières lettres ou repères de mots) ; on le dévoile en touchant le verset ou en mettant en pause.
  Le surlignage est exact (horodatages mot à mot de Quran.com) pour 7 récitateurs dont le fichier audio est identique octet pour octet à celui de l'app, et estimé pour les autres.
- **Suivi par verset** : sur chaque verset, *Mémorisé* (pour savoir où l'on en est), *Favori* et *Note*. Une sourate dont tous les versets sont cochés compte comme apprise. L'onglet Hifz sert de tableau de bord (versets mémorisés, bouton « Continuer » vers le prochain groupe à apprendre, favoris, notes) et propose trois méthodes prêtes à l'emploi (Apprendre, Consolider, Tester de mémoire). Ces données restent sur l'appareil ; l'export JSON les inclut.
- **14 récitateurs** (Alafasy, As-Sudais, Ash-Shuraym, Al-Muaiqly, Al-Husary dont la version pédagogique « Muallim »,
  Abdul Basit, Al-Minshawi…), boucle 1×/3×/5× par verset.
- **Marquage Hizb** : marqueurs ۞ dans le texte (début de Hizb, ¼, ½, ¾), vue des 60 Hizb / 240 quarts avec suivi et accès direct au texte.
- Suivi des sourates apprises, statistiques de récitation par verset, export/import de la progression (JSON).
- Thème clair / sombre / automatique, installable sur l'écran d'accueil de l'iPhone et de l'iPad.

## Icônes

L'interface n'utilise aucun emoji : les icônes viennent de [Lucide](https://lucide.dev) via le composant `src/components/Icon.tsx`. Elles héritent de la couleur du texte (donc du mode sombre et des états) et de sa taille. Pour en ajouter une, déclarer un nom dans `Icon.tsx` puis écrire `<Icon name="..." />`. Un test (`src/lib/no-emoji.test.ts`) échoue si un emoji ou un symbole-icône (▶, ✓, ♥…) réapparaît dans le code.

## Développement

```bash
npm install
npm run dev        # serveur local
npm test           # tests (moteur de comparaison vocale, Hizb)
npm run build      # build de production (dist/)
npm run data       # régénère public/data à partir des API publiques
npm run privacy    # contrôle de confidentialité (fichiers indexés)
```

## Confidentialité

Le dépôt est public : aucune information privée ne doit y entrer. Un contrôle automatique
(`scripts/privacy-check.mjs`) bloque les IP privées, e-mails, numéros de téléphone, chemins de profil, jetons et clés,
ainsi que les identités git personnelles. Il tourne :

- avant chaque **commit** (hook `.githooks/pre-commit`) ;
- avant chaque **push** (hook `.githooks/pre-push`, arbre complet + historique) ;
- dans la **CI** avant le déploiement, sur les sources puis sur le site compilé.

Après un clone : `git config core.hooksPath .githooks`. Les termes personnels à interdire se placent dans un fichier local
`.privacy-denylist` (ignoré par git, un terme par ligne).

## Déploiement (GitHub Pages)

Chaque push sur `main` déclenche `.github/workflows/deploy.yml`. Dans le dépôt : *Settings → Pages → Source : GitHub Actions*.

## Sources et crédits

- Texte coranique : [Tanzil](https://tanzil.net) (édition uthmanique), via [api.alquran.cloud](https://alquran.cloud/api). Texte non modifié.
- Traduction française : Muhammad Hamidullah (`fr.hamidullah`).
- Audio : [everyayah.com](https://everyayah.com).
- Horodatage des mots (surlignage synchronisé) : [Quran.com API](https://api.quran.com) — régénérable avec `node scripts/build-timings.mjs` (Node ≥ 23.6).
- Le contenu pédagogique (leviers Darija, Tajwid) n'est rédigé que pour 6 sourates (1, 103, 108, 112, 113, 114) et doit être relu par une personne qualifiée avant diffusion large.
