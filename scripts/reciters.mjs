/**
 * Récitateurs proposés (source audio : everyayah.com — fichiers vérifiés en HTTP 200).
 * `folder` = sous-dossier sur everyayah.com ; URL : https://everyayah.com/data/<folder>/<SSS><AAA>.mp3
 * `qcId` : identifiant Quran.com, présent seulement si son fichier audio est identique octet pour octet à celui de everyayah
 * (donc les horodatages mot à mot de Quran.com s'appliquent : surlignage synchronisé). Absent = surlignage estimé.
 * `style` : murattal = récitation posée, mujawwad = mélodieuse, muallim = pédagogique (répétition, idéal pour mémoriser).
 */
export const RECITERS = [
  { id: 'alafasy', name: 'Mishary Rashid Alafasy', country: 'Koweït', style: 'murattal', folder: 'Alafasy_128kbps', qcId: 7 },
  { id: 'sudais', name: 'Abdurrahman As-Sudais', country: 'Arabie saoudite', style: 'murattal', folder: 'Abdurrahmaan_As-Sudais_192kbps', qcId: 3 },
  { id: 'shuraym', name: 'Saud Ash-Shuraym', country: 'Arabie saoudite', style: 'murattal', folder: 'Saood_ash-Shuraym_128kbps', qcId: 10 },
  { id: 'muaiqly', name: 'Maher Al-Muaiqly', country: 'Arabie saoudite', style: 'murattal', folder: 'MaherAlMuaiqly128kbps' },
  { id: 'husary', name: 'Mahmoud Khalil Al-Husary', country: 'Égypte', style: 'murattal', folder: 'Husary_128kbps' },
  { id: 'husary-muallim', name: 'Al-Husary (Muallim, pour apprendre)', country: 'Égypte', style: 'muallim', folder: 'Husary_Muallim_128kbps' },
  { id: 'abdulbasit', name: 'Abdul Basit Abdus-Samad', country: 'Égypte', style: 'murattal', folder: 'Abdul_Basit_Murattal_192kbps', qcId: 2 },
  { id: 'minshawy', name: 'Mohamed Siddiq Al-Minshawi', country: 'Égypte', style: 'murattal', folder: 'Minshawy_Murattal_128kbps', qcId: 9 },
  { id: 'shaatree', name: 'Abu Bakr Ash-Shatri', country: 'Arabie saoudite', style: 'murattal', folder: 'Abu_Bakr_Ash-Shaatree_128kbps', qcId: 4 },
  { id: 'hudhaify', name: 'Ali Al-Hudhaify', country: 'Arabie saoudite', style: 'murattal', folder: 'Hudhaify_128kbps' },
  { id: 'dussary', name: 'Yasser Ad-Dossari', country: 'Arabie saoudite', style: 'murattal', folder: 'Yasser_Ad-Dussary_128kbps' },
  { id: 'qatami', name: 'Nasser Al-Qatami', country: 'Arabie saoudite', style: 'murattal', folder: 'Nasser_Alqatami_128kbps' },
  { id: 'rifai', name: 'Hani Ar-Rifai', country: 'Arabie saoudite', style: 'murattal', folder: 'Hani_Rifai_192kbps', qcId: 5 },
  { id: 'ghamadi', name: 'Saad Al-Ghamdi', country: 'Arabie saoudite', style: 'murattal', folder: 'Ghamadi_40kbps' },
];

export const DEFAULT_RECITER = 'alafasy';
