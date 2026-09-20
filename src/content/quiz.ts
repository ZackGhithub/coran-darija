export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export const QUIZ: QuizQuestion[] = [
  {
    "question": "Dans la Fatiha, le mot « Nasta3în » (نستعين) correspond à quel mot usuel en Darija ?",
    "options": [
      "« N-Na3ass » (Le sommeil)",
      "« L-3wân » ou « 3awnou » (L'aide / l'assistance)",
      "« L-3ayn » (Le regard)",
      "« L-3arbi » (La langue arabe)"
    ],
    "correct": 1,
    "explanation": "« Nasta3în » vient de la racine 3-W-N qui signifie l'entraide et le secours, exactement comme « 3awnouni » ou « l-3wân » en Darija !"
  },
  {
    "question": "Dans la sourate Al-Ikhlas, que signifie la racine commune de « Lam yalid wa lam yoûlad » ?",
    "options": [
      "La royauté et le pouvoir",
      "La naissance et la descendance (comme « wled / drari » en Darija)",
      "La parole et la voix",
      "La force invincible"
    ],
    "correct": 1,
    "explanation": "La racine W-L-D signifie engendrer ou donner naissance, mot à mot le verbe « wled » et « drari / l-wlad » en Darija !"
  },
  {
    "question": "Dans la sourate Al-Falaq, d'où provient le mot « Al-3ou9ad » (العقد) ?",
    "options": [
      "De « L-3o9da » (Le nœud / l'attache)",
      "De « L-3a9l » (La raison)",
      "De « L-3achra » (Les dix)",
      "De « L-3oud » (Le bois)"
    ],
    "correct": 0,
    "explanation": "« 3ou9ad » est le pluriel direct de « 3o9da » (le nœud), terme universel en Darija pour un nœud physique ou moral."
  },
  {
    "question": "Quel piège fréquent de prononciation doit éviter un locuteur de Darija sur le mot « Kitâb » ?",
    "options": [
      "Prononcer le T comme un S",
      "Escamoter la voyelle courte en prononçant « Ktab » sans la kasra de 1 temps",
      "Transformer le B en V",
      "Remplacer le K par un Qaf"
    ],
    "correct": 1,
    "explanation": "En Darija, les voyelles brèves sautent naturellement (« ktab », « chreb »). En Tajwid, la kasra (Ki) doit durer exactement 1 temps complet !"
  },
  {
    "question": "Dans la sourate Al-Kawthar, « A3taynâka » dérive de quelle racine utilisée quotidiennement en Darija ?",
    "options": [
      "« 3tâ / 3tini » (Donner)",
      "« 3elem » (Enseigner)",
      "« 3awed » (Raconter)",
      "« 3telle » (Retarder)"
    ],
    "correct": 0,
    "explanation": "« A3tayna » signifie 'Nous t'avons donné', de la racine 3-T-Y qui est le verbe donner par excellence en Darija (« 3tini »)."
  }
];
