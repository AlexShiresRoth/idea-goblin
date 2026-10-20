import {
  bucketStyle,
  isBucketCategory,
  type BucketIconName,
} from "@/lib/constants";
import clsx from "clsx";
import type { CSSProperties } from "react";
import {
  BabyIcon,
  BotIcon,
  BriefcaseIcon,
  CalendarIcon,
  CameraIcon,
  CarIcon,
  CodeIcon,
  CpuIcon,
  DatabaseIcon,
  DollarSignIcon,
  DumbbellIcon,
  FilmIcon,
  FlaskConicalIcon,
  FolderIcon,
  Gamepad2Icon,
  GraduationCapIcon,
  HeartIcon,
  HeartPulseIcon,
  HouseIcon,
  LeafIcon,
  LightbulbIcon,
  MegaphoneIcon,
  MicIcon,
  MusicIcon,
  PaletteIcon,
  PawPrintIcon,
  PenToolIcon,
  PlaneIcon,
  RocketIcon,
  ShieldIcon,
  ShirtIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  TrophyIcon,
  UsersIcon,
  UtensilsIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<BucketIconName, LucideIcon> = {
  folder: FolderIcon,
  rocket: RocketIcon,
  lightbulb: LightbulbIcon,
  code: CodeIcon,
  smartphone: SmartphoneIcon,
  bot: BotIcon,
  database: DatabaseIcon,
  cpu: CpuIcon,
  palette: PaletteIcon,
  "pen-tool": PenToolIcon,
  camera: CameraIcon,
  film: FilmIcon,
  music: MusicIcon,
  mic: MicIcon,
  gamepad: Gamepad2Icon,
  "graduation-cap": GraduationCapIcon,
  briefcase: BriefcaseIcon,
  "dollar-sign": DollarSignIcon,
  megaphone: MegaphoneIcon,
  "shopping-cart": ShoppingCartIcon,
  users: UsersIcon,
  "heart-pulse": HeartPulseIcon,
  dumbbell: DumbbellIcon,
  utensils: UtensilsIcon,
  leaf: LeafIcon,
  plane: PlaneIcon,
  house: HouseIcon,
  car: CarIcon,
  baby: BabyIcon,
  "paw-print": PawPrintIcon,
  shirt: ShirtIcon,
  calendar: CalendarIcon,
  flask: FlaskConicalIcon,
  shield: ShieldIcon,
  wrench: WrenchIcon,
  trophy: TrophyIcon,
  heart: HeartIcon,
};

// Sets --bucket-primary/accent/tertiary for everything inside, so children
// can use classes like text-(--bucket-primary) or bg-(--bucket-accent)/15.
export function bucketStyleVars(category: unknown): CSSProperties {
  const style = bucketStyle(category);
  return {
    "--bucket-primary": style.primary,
    "--bucket-accent": style.accent,
    "--bucket-tertiary": style.tertiary,
  } as CSSProperties;
}

// Draws the category's icon in its primary color. Unknown or missing
// categories get the default folder style.
export function BucketIcon({
  category,
  className,
}: {
  category: string | null | undefined;
  className?: string;
}) {
  const Icon = ICONS[bucketStyle(category).icon];
  return (
    <Icon
      aria-hidden
      data-testid="bucket-icon"
      data-category={isBucketCategory(category) ? category : "default"}
      style={bucketStyleVars(category)}
      className={clsx("shrink-0 text-(--bucket-primary)", className)}
    />
  );
}
