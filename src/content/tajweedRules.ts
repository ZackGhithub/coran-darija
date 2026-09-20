/**
 * Fiches des 17 règles de Tajwid colorées (lecture de Hafs ʿan ʿĀṣim).
 *
 * Contenu d'aide à l'apprentissage, rédigé d'après les règles classiques : il doit être relu par une personne qualifiée
 * avant une diffusion large, et ne remplace pas un enseignant. Les noms de règles suivent Quran.com (source des couleurs).
 * Les prononciations en lettres latines suivent la convention de l'application (3, 7, 9…, « ou » pour la voyelle u).
 */

export type Family = 'silent' | 'madd' | 'qalqala' | 'nasal' | 'idgham';

export const FAMILY_LABEL: Record<Family, string> = {
  silent: 'Lettres liées ou muettes',
  madd: 'Prolongations (madd)',
  qalqala: 'Écho (qalqala)',
  nasal: 'Nasalisation et dissimulation',
  idgham: 'Fusion (idghām)',
};

export interface TajweedRule {
  code: string;
  ar: string; // nom arabe
  fr: string; // nom français
  family: Family;
  summary: string; // en une phrase
  when: string; // à quelle condition la règle s'applique
  how: string[]; // comment la prononcer, pas à pas
  timing?: string; // durée en temps (harakāt)
  mistakes: string[]; // erreurs fréquentes à éviter
  darija?: string; // lien avec le darija, seulement quand il est sûr
}

export const RULES: TajweedRule[] = [
  {
    code: 'ham_wasl',
    ar: 'هَمْزَةُ الْوَصْل',
    fr: "Hamza d'union (hamzat al-waṣl)",
    family: 'silent',
    summary: "Un alif qui n'est prononcé que si l'on commence la récitation sur ce mot ; quand on enchaîne depuis le mot précédent, il disparaît.",
    when: "Elle est écrite ٱ au début d'un mot : l'article « ال » (ٱلْحَمْدُ), les verbes à l'impératif (ٱهْدِنَا), certains noms (ٱسْم).",
    how: [
      "En enchaînant depuis le mot précédent : ne la prononcez pas. Reliez la dernière lettre du mot précédent directement à la lettre suivante (« رَبِّ ٱلْعَالَمِينَ » se dit « rabbil-3âlamîn »).",
      "En commençant sur ce mot (ou après un arrêt) : prononcez-la avec une voyelle brève. Pour l'article « ال », c'est une fatha (« al- »). Pour un verbe, la voyelle dépend du mot : demandez-la à votre enseignant.",
    ],
    mistakes: ["Prononcer le alif au milieu d'une phrase, comme si le mot commençait toujours par « a »."],
  },
  {
    code: 'slnt',
    ar: 'حَرْفٌ لَا يُنْطَق',
    fr: 'Lettre muette (non prononcée)',
    family: 'silent',
    summary: 'Une lettre écrite dans le texte mais qu\'on ne prononce pas.',
    when: "Le cas le plus fréquent est le alif écrit après le waw du pluriel, à la fin d'un mot (« عَبَدُوا۟ », « ءَامَنُوا۟ »). Il est signalé dans le texte par un petit signe rond au-dessus de la lettre.",
    how: [
      "Prononcez normalement le waw qui précède (voyelle longue de 2 temps).",
      "Ne lisez pas la lettre muette : le mot s'arrête sur le waw, sans « a » supplémentaire.",
    ],
    mistakes: ["Lire le alif final (« ʿabadoû-a » au lieu de « ʿabadoû »)."],
  },
  {
    code: 'laam_shamsiyah',
    ar: 'لَامٌ شَمْسِيَّة',
    fr: 'Lam solaire (lām shamsiyya)',
    family: 'silent',
    summary: "Le lam de l'article « ال » ne se prononce pas devant une « lettre solaire » : la lettre suivante est doublée.",
    when: "L'article « ال » est suivi de l'une des 14 lettres solaires : ت ث د ذ ر ز س ش ص ض ط ظ ل ن. La lettre suivante porte alors une shadda dans le texte.",
    how: [
      "Ne prononcez pas le « l ».",
      "Placez directement la langue au point d'articulation de la lettre suivante et doublez-la, comme si elle portait une shadda : « ٱلشَّمْس » se dit « ash-shams », « ٱلنَّاس » se dit « an-nâs ».",
    ],
    mistakes: ["Prononcer le lam quand même (« al-shams », « al-nâs »)."],
    darija: 'Le darija fait généralement déjà cette assimilation (« ش-شمس », « ن-ناس ») : gardez ce réflexe en récitant.',
  },
  {
    code: 'madda_normal',
    ar: 'الْمَدُّ الطَّبِيعِيّ',
    fr: 'Madd naturel (madd ṭabīʿī / aṣlī)',
    family: 'madd',
    summary: 'Prolongation de la voyelle sur 2 temps.',
    when: "Une lettre de prolongation (alif après une fatha, waw après une damma, ya après une kasra) qui n'est suivie ni d'une hamza ni d'un soukoun. Elle est aussi notée par de petits signes : alif en exposant (ٰ), petit waw (ۥ), petit ya (ۦ).",
    how: [
      "Tenez la voyelle exactement 2 temps.",
      "Un temps correspond à la durée d'une voyelle courte : un repère souvent enseigné est le temps de plier ou de déplier un doigt.",
      "Gardez la même durée dans toute la récitation.",
    ],
    timing: '2 temps',
    mistakes: ["Raccourcir la voyelle longue en la traitant comme une voyelle brève.", "L'allonger trop, ce qui change la règle."],
  },
  {
    code: 'madda_permissible',
    ar: 'الْمَدُّ الْعَارِضُ لِلسُّكُون',
    fr: 'Madd permis (ʿārid li-s-soukoûn)',
    family: 'madd',
    summary: "Prolongation de 2, 4 ou 6 temps quand on s'arrête sur le mot.",
    when: "La lettre de prolongation est suivie d'une dernière lettre qui n'a un soukoun que parce qu'on s'arrête (fin de verset ou pause) : « ٱلنَّاسِ », « ٱلرَّحِيمِ ».",
    how: [
      "Si vous vous arrêtez sur le mot : prolongez de 2, 4 ou 6 temps, au choix.",
      "Choisissez une durée et gardez-la d'un verset à l'autre.",
      "Si vous continuez sans vous arrêter, cette prolongation disparaît : lisez la voyelle normalement.",
    ],
    timing: '2, 4 ou 6 temps à l\'arrêt',
    mistakes: ["Changer de durée d'un verset à l'autre.", "S'arrêter sans prolonger du tout."],
  },
  {
    code: 'madda_obligatory',
    ar: 'الْمَدُّ الْوَاجِب',
    fr: 'Madd obligatoire (4 à 5 temps)',
    family: 'madd',
    summary: "Prolongation d'au moins 4 temps devant une hamza.",
    when: "La lettre de prolongation est suivie d'une hamza. Soit dans le même mot (madd muttaṣil : « جَآءَ », « ٱلسَّمَآءِ »), soit au début du mot suivant (madd munfaṣil : « يَدَآ أَبِى »). Cette colorisation regroupe les deux.",
    how: [
      "Prolongez de 4 ou 5 temps selon la manière apprise avec votre enseignant (Hafs ʿan ʿĀṣim, transmission de ash-Shāṭibiyya).",
      "Gardez toujours la même durée pour ce type de madd.",
    ],
    timing: '4 à 5 temps',
    mistakes: ["Se contenter de 2 temps, comme un madd naturel.", "Varier la durée d'une occurrence à l'autre."],
  },
  {
    code: 'madda_necessary',
    ar: 'الْمَدُّ اللَّازِم',
    fr: 'Madd nécessaire (6 temps)',
    family: 'madd',
    summary: 'La prolongation la plus longue : 6 temps, toujours.',
    when: "La lettre de prolongation est suivie d'une lettre portant une shadda ou un soukoun permanent (« ٱلضَّآلِّينَ », « ٱلصَّآخَّةُ »). C'est aussi le cas des lettres épelées qui ouvrent certaines sourates (« الٓمٓ »).",
    how: [
      "Prolongez de 6 temps, sans exception.",
      "Gardez un son stable pendant toute la durée, sans le laisser retomber.",
    ],
    timing: '6 temps',
    mistakes: ["Le raccourcir à 2 temps.", "Le couper avant la fin de la prolongation."],
  },
  {
    code: 'qalaqah',
    ar: 'الْقَلْقَلَة',
    fr: 'Qalqala (écho)',
    family: 'qalqala',
    summary: 'Léger rebond sonore sur ق ط ب ج د quand elles portent un soukoun.',
    when: "L'une des cinq lettres de « قُطْبُ جَدٍّ » porte un soukoun, ou l'on s'arrête dessus en fin de verset : « أَحَدْ » (à l'arrêt), « يَلِدْ ».",
    how: [
      "Prononcez la lettre, puis relâchez-la avec un petit rebond, comme un léger écho.",
      "N'ajoutez aucune voyelle : on n'entend ni « a », ni « i », ni « ou », seulement le rebond.",
      "Le rebond est plus marqué quand on s'arrête sur la lettre (fin de verset) que lorsqu'elle est au milieu d'un mot.",
    ],
    mistakes: ["Ajouter une voyelle (« ahada » au lieu de « ahad »).", "Couper la lettre net, sans aucun rebond."],
  },
  {
    code: 'ghunnah',
    ar: 'الْغُنَّة',
    fr: 'Ghunna (nasalisation)',
    family: 'nasal',
    summary: 'Son nasal de 2 temps sur un noun ou un mim portant une shadda.',
    when: "Un ن ou un م porte une shadda : « ٱلنَّاسِ » (le noun de « ال » assimilé), « إِنَّ », « ثُمَّ ».",
    how: [
      "Faites passer le son par le nez pendant 2 temps.",
      "Pour le noun, la langue reste appuyée derrière les incisives supérieures. Pour le mim, les lèvres restent fermées.",
      "Repère : en pinçant légèrement le nez pendant ce son, vous devez sentir une vibration.",
    ],
    timing: '2 temps',
    mistakes: ["Ne pas nasaliser (un « n » ou un « m » simple, sans tenue).", "Tenir bien au-delà de 2 temps."],
  },
  {
    code: 'ikhafa',
    ar: 'الْإِخْفَاء',
    fr: 'Ikhfā\' (dissimulation du noun)',
    family: 'nasal',
    summary: 'Devant 15 lettres, le noun sans voyelle ou le tanwîn est « caché » : on entend surtout la nasalisation.',
    when: "Un noun sans voyelle (نْ) ou un tanwîn est suivi de l'une de ces 15 lettres : ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك.",
    how: [
      "N'articulez pas un « n » net : la langue se prépare vers la position de la lettre suivante sans toucher le palais.",
      "Nasalisez pendant 2 temps, puis enchaînez sur la lettre suivante.",
      "Devant ص ض ط ظ ق (lettres lourdes) la nasalisation est prononcée avec un son plus plein ; devant les autres lettres, plus léger.",
    ],
    timing: '2 temps de nasalisation',
    mistakes: ["Prononcer un noun net, langue collée au palais.", "Oublier la nasalisation."],
  },
  {
    code: 'ikhafa_shafawi',
    ar: 'الْإِخْفَاءُ الشَّفَوِيّ',
    fr: "Ikhfā' labial (mim sakin devant ب)",
    family: 'nasal',
    summary: 'Un mim sans voyelle devant ب : les lèvres se touchent à peine, avec nasalisation.',
    when: 'Un م sans voyelle est suivi de la lettre ب : « تَرْمِيهِم بِحِجَارَةٍ ».',
    how: [
      "Rapprochez légèrement les lèvres, sans les presser.",
      "Nasalisez pendant 2 temps, puis prononcez le ب.",
    ],
    timing: '2 temps de nasalisation',
    mistakes: ["Fermer fermement les lèvres comme pour un mim net.", "Ne pas nasaliser."],
  },
  {
    code: 'iqlab',
    ar: 'الْإِقْلَاب',
    fr: 'Iqlāb (transformation en mim)',
    family: 'nasal',
    summary: 'Le noun sans voyelle ou le tanwîn se change en un mim caché devant la lettre ب.',
    when: 'Un noun sans voyelle ou un tanwîn est suivi de ب : « مِنۢ بَعْدِ ». Un petit mim (ۢ) est écrit au-dessus de la lettre.',
    how: [
      "Prononcez le noun comme un mim, les lèvres à peine rapprochées.",
      "Nasalisez pendant 2 temps, puis prononcez le ب.",
    ],
    timing: '2 temps de nasalisation',
    mistakes: ["Dire « n » (« min ba3d » au lieu de « mim-ba3d » nasalisé).", "Fermer fermement les lèvres."],
  },
  {
    code: 'idgham_ghunnah',
    ar: 'الْإِدْغَامُ بِغُنَّة',
    fr: 'Idghām avec ghunna',
    family: 'idgham',
    summary: 'Le noun sans voyelle ou le tanwîn fusionne dans la lettre suivante (ي ن م و), avec nasalisation.',
    when: "Un noun sans voyelle ou un tanwîn en fin de mot est suivi, au début du mot suivant, de ي ن م ou و (mémo : « يَنْمُو »). Dans un même mot il n'y a pas d'idghām : « دُنْيَا », « بُنْيَانٌ » se disent avec un noun net.",
    how: [
      "Ne prononcez pas le noun : fondez-le dans la lettre suivante, qui se double.",
      "Conservez une nasalisation de 2 temps.",
    ],
    timing: '2 temps de nasalisation',
    mistakes: ["Prononcer le noun clairement.", "Fondre sans nasaliser."],
  },
  {
    code: 'idgham_wo_ghunnah',
    ar: 'الْإِدْغَامُ بِغَيْرِ غُنَّة',
    fr: 'Idghām sans ghunna',
    family: 'idgham',
    summary: 'Le noun sans voyelle ou le tanwîn fusionne complètement dans ل ou ر, sans nasalisation.',
    when: "Un noun sans voyelle ou un tanwîn en fin de mot est suivi, au début du mot suivant, de ل ou ر : « مِن رَّبِّهِمْ ».",
    how: [
      "Fondez le noun dans la lettre suivante, qui se double : « مِن رَّبِّهِمْ » se dit « mir-rabbihim ».",
      "Aucune nasalisation.",
    ],
    mistakes: ["Nasaliser (« min-rabbihim » nasalisé).", "Prononcer le noun avant de fondre."],
  },
  {
    code: 'idgham_shafawi',
    ar: 'الْإِدْغَامُ الشَّفَوِيّ',
    fr: 'Idghām labial (mim dans mim)',
    family: 'idgham',
    summary: 'Un mim sans voyelle suivi d\'un mim : les deux ne font plus qu\'un mim doublé, nasalisé.',
    when: 'Un م sans voyelle est suivi de م : « لَهُم مَّا ».',
    how: [
      "Fondez les deux mim en un seul mim doublé (une shadda).",
      "Nasalisez pendant 2 temps.",
    ],
    timing: '2 temps de nasalisation',
    mistakes: ["Prononcer deux mim séparés.", "Ne pas nasaliser."],
  },
  {
    code: 'idgham_mutajanisayn',
    ar: 'إِدْغَامُ الْمُتَجَانِسَيْن',
    fr: 'Idghām de lettres de même articulation',
    family: 'idgham',
    summary: 'Deux lettres qui sortent du même endroit de la bouche : la première, sans voyelle, se fond dans la seconde.',
    when: "La première lettre est sans voyelle et la seconde sort du même endroit de la bouche mais avec une qualité différente. Dans le Coran : د suivie de ت (« قَد تَّبَيَّنَ »), ت suivie de ط (« وَدَّت طَّآئِفَةٌ »), ت suivie de د (« أَثْقَلَت دَّعَوَا »), ذ suivie de ظ (« إِذ ظَّلَمْتُمْ »), ث suivie de ذ (« يَلْهَث ذَّٰلِكَ ») et ب suivie de م (« ٱرْكَب مَّعَنَا »).",
    how: [
      "Ne prononcez pas la première lettre : fondez-la dans la seconde, qui se double.",
      "Gardez la langue (ou les lèvres) au même endroit pour les deux lettres.",
    ],
    mistakes: ["Prononcer les deux lettres l'une après l'autre.", "Doubler sans fondre la première."],
  },
  {
    code: 'idgham_mutaqaribayn',
    ar: 'إِدْغَامُ الْمُتَقَارِبَيْن',
    fr: 'Idghām de lettres proches',
    family: 'idgham',
    summary: 'Deux lettres aux articulations proches : la première, sans voyelle, se fond dans la seconde.',
    when: "Cas rares dans le Coran : ل suivie de ر (« قُل رَّبِّ », « بَل رَّفَعَهُ ») et ق suivie de ك (« نَخْلُقكُّم »).",
    how: [
      "Fondez la première lettre dans la seconde, qui se double.",
      "Enchaînez sans marquer de coupure entre les deux.",
    ],
    mistakes: ["Séparer les deux lettres.", "Ne pas doubler la seconde."],
  },
];

export const RULE_BY_CODE: Record<string, TajweedRule> = Object.fromEntries(RULES.map((r) => [r.code, r]));

/** Nom français d'une lettre arabe (pour expliquer « pourquoi ici »). */
export const LETTER_NAME: Record<string, string> = {
  ا: 'alif', ٱ: 'alif', أ: 'alif', إ: 'alif', آ: 'alif', ء: 'hamza', ب: 'bā’', ت: 'tā’', ث: 'thā’', ج: 'jīm', ح: 'ḥā’', خ: 'khā’',
  د: 'dāl', ذ: 'dhāl', ر: 'rā’', ز: 'zāy', س: 'sīn', ش: 'shīn', ص: 'ṣād', ض: 'ḍād', ط: 'ṭā’', ظ: 'ẓā’', ع: 'ʿayn', غ: 'ghayn',
  ف: 'fā’', ق: 'qāf', ك: 'kāf', ل: 'lām', م: 'mīm', ن: 'noun', ه: 'hā’', و: 'waw', ي: 'yā’', ى: 'yā’', ة: 'tā’ marbūṭa', ؤ: 'waw', ئ: 'yā’',
};

/** Point d'articulation des cinq lettres de la qalqala. */
export const QALQALA_MAKHRAJ: Record<string, string> = {
  ق: "le fond de la langue contre le palais mou (tout au fond de la bouche) ; c'est une lettre « lourde »",
  ط: 'le bout de la langue contre la base des incisives supérieures, avec un son plein (lettre « lourde »)',
  ب: 'les deux lèvres',
  ج: 'le milieu de la langue contre le palais dur',
  د: 'le bout de la langue contre la base des incisives supérieures',
};

/** Les lettres « lourdes » devant lesquelles l'ikhfā' est prononcé avec un son plus plein. */
export const HEAVY_LETTERS = new Set(['ص', 'ض', 'ط', 'ظ', 'ق']);

/** Lettres attendues après chaque règle (sert à expliquer « pourquoi ici » et à vérifier les données). */
export const TRIGGERS: Record<string, string[]> = {
  ikhafa: ['ت', 'ث', 'ج', 'د', 'ذ', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ف', 'ق', 'ك'],
  iqlab: ['ب'],
  idgham_ghunnah: ['ي', 'ن', 'م', 'و'],
  idgham_wo_ghunnah: ['ل', 'ر'],
  ikhafa_shafawi: ['ب'],
  idgham_shafawi: ['م'],
  idgham_mutajanisayn: ['د', 'ط', 'ت', 'ظ', 'ذ', 'م'],
  idgham_mutaqaribayn: ['ر', 'ك'],
};

/** Couleur d'une règle : variable CSS (voir styles.css, claire et sombre). */
export const ruleColorVar = (code: string) => `var(--tj-${code.replace(/_/g, '-')})`;
