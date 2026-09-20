import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Circle,
  CircleCheck,
  CircleDashed,
  Compass,
  Dot,
  Download,
  Eye,
  Gauge,
  Heart,
  Languages,
  Lightbulb,
  MessageCircle,
  Mic,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Settings,
  SkipBack,
  SkipForward,
  Square,
  SquareCheck,
  StickyNote,
  Sun,
  SunMoon,
  Target,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react';

/**
 * Icônes de l'application (bibliothèque Lucide, tracés vectoriels).
 *
 * - Les noms décrivent le RÔLE (« memorized », « favorite »…), pas le dessin : changer de bibliothèque ne demande de
 *   modifier que ce fichier.
 * - La couleur vient du texte environnant (currentColor) : mode clair/sombre, états actif/désactivé et boutons colorés
 *   fonctionnent sans code en plus.
 * - La taille suit celle du texte (1.15em par défaut) : une icône dans un gros bouton grossit avec lui.
 */
const ICONS = {
  play: Play,
  pause: Pause,
  stop: Square,
  prev: SkipBack,
  next: SkipForward,
  tempo: Gauge,
  repeat: Repeat,
  mic: Mic,
  restart: RotateCcw,
  check: Check,
  done: CircleCheck, // appris, terminé
  todo: Circle, // pas encore appris
  estimated: CircleDashed, // approximatif
  wrong: X,
  memorized: SquareCheck,
  unmemorized: Square,
  favorite: Heart,
  note: StickyNote,
  book: BookOpen,
  brain: Brain,
  target: Target,
  compass: Compass,
  settings: Settings,
  sun: Sun,
  moon: Moon,
  auto: SunMoon,
  download: Download,
  upload: Upload,
  up: ArrowUp,
  right: ArrowRight,
  chevron: ChevronDown,
  collapse: ChevronsUp,
  expand: ChevronsDown,
  idea: Lightbulb,
  translate: Languages,
  eye: Eye,
  speak: MessageCircle,
  warning: TriangleAlert,
  minus: Minus,
  plus: Plus,
  dot: Dot,
} as const;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  /** Taille : nombre (px) ou longueur CSS. Par défaut 1.15em : suit la taille du texte. */
  size?: number | string;
  /** Icône pleine (lecture, cœur actif…) plutôt que tracée en contour. */
  filled?: boolean;
  strokeWidth?: number;
  className?: string;
}

export default function Icon({ name, size = '1.15em', filled = false, strokeWidth = 2, className = '' }: Props) {
  const Component = ICONS[name];
  // Décorative : le texte du bouton (ou son aria-label) porte le sens pour les lecteurs d'écran.
  return <Component className={`ico ${className}`.trim()} size={size} strokeWidth={strokeWidth} fill={filled ? 'currentColor' : 'none'} aria-hidden="true" focusable="false" />;
}
