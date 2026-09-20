# Coran Darija

Application web (PWA) pour apprendre à lire, réciter et mémoriser le Coran en s'appuyant sur le Darija :
translittération avec les chiffres 3-7-9, « leviers » de racines communes, conseils de Tajwid pour darijophones.

## Fonctionnalités

- **114 sourates** complètes (texte arabe, traduction française), lisibles **hors ligne** une fois l'app chargée.
- **Récitation vocale** : le bouton « Réciter » écoute la voix et colore chaque mot, **vert** si reconnu, **rouge** si faux ou sauté.
  La comparaison porte sur les mots (consonnes), pas sur les voyelles brèves ni le tajwid (limite des moteurs vocaux).
- **14 récitateurs** (Alafasy, As-Sudais, Ash-Shuraym, Al-Muaiqly, Al-Husary dont la version pédagogique « Muallim »,
  Abdul Basit, Al-Minshawi…), boucle 1×/3×/5× par verset.
- **Marquage Hizb** : marqueurs ۞ dans le texte (début de Hizb, ¼, ½, ¾), vue des 60 Hizb / 240 quarts avec suivi et accès direct au texte.
- Suivi des sourates apprises, statistiques de récitation par verset, export/import de la progression (JSON).
- Thème clair / sombre / automatique, installable sur l'écran d'accueil de l'iPhone et de l'iPad.

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
- Le contenu pédagogique (leviers Darija, Tajwid) n'est rédigé que pour 6 sourates (1, 103, 108, 112, 113, 114) et doit être relu par une personne qualifiée avant diffusion large.
