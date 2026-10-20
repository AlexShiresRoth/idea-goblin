// Categories the model may pick for a bucket, each with its icon and colors.
// Colors are written as full `var(--color-*)` references so Tailwind finds
// them in source and emits those palette variables; BucketCategoryStyle
// exposes them to components as --bucket-primary/accent/tertiary.
export type BucketIconName =
  | "folder"
  | "rocket"
  | "lightbulb"
  | "code"
  | "smartphone"
  | "bot"
  | "database"
  | "cpu"
  | "palette"
  | "pen-tool"
  | "camera"
  | "film"
  | "music"
  | "mic"
  | "gamepad"
  | "graduation-cap"
  | "briefcase"
  | "dollar-sign"
  | "megaphone"
  | "shopping-cart"
  | "users"
  | "heart-pulse"
  | "dumbbell"
  | "utensils"
  | "leaf"
  | "plane"
  | "house"
  | "car"
  | "baby"
  | "paw-print"
  | "shirt"
  | "calendar"
  | "flask"
  | "shield"
  | "wrench"
  | "trophy"
  | "heart";

export type BucketCategoryStyle = {
  icon: BucketIconName;
  primary: string;
  accent: string;
  tertiary: string;
};

export const BUCKET_CATEGORIES = {
  software: {
    icon: "code",
    primary: "var(--color-sky-400)",
    accent: "var(--color-sky-500)",
    tertiary: "var(--color-sky-300)",
  },
  mobile: {
    icon: "smartphone",
    primary: "var(--color-blue-400)",
    accent: "var(--color-blue-500)",
    tertiary: "var(--color-blue-300)",
  },
  ai: {
    icon: "bot",
    primary: "var(--color-violet-400)",
    accent: "var(--color-violet-500)",
    tertiary: "var(--color-violet-300)",
  },
  data: {
    icon: "database",
    primary: "var(--color-cyan-400)",
    accent: "var(--color-cyan-500)",
    tertiary: "var(--color-cyan-300)",
  },
  hardware: {
    icon: "cpu",
    primary: "var(--color-slate-300)",
    accent: "var(--color-slate-500)",
    tertiary: "var(--color-slate-300)",
  },
  startup: {
    icon: "rocket",
    primary: "var(--color-orange-400)",
    accent: "var(--color-orange-500)",
    tertiary: "var(--color-orange-300)",
  },
  design: {
    icon: "palette",
    primary: "var(--color-pink-400)",
    accent: "var(--color-pink-500)",
    tertiary: "var(--color-pink-300)",
  },
  writing: {
    icon: "pen-tool",
    primary: "var(--color-amber-300)",
    accent: "var(--color-amber-500)",
    tertiary: "var(--color-amber-300)",
  },
  photography: {
    icon: "camera",
    primary: "var(--color-zinc-300)",
    accent: "var(--color-zinc-500)",
    tertiary: "var(--color-zinc-300)",
  },
  video: {
    icon: "film",
    primary: "var(--color-red-400)",
    accent: "var(--color-red-500)",
    tertiary: "var(--color-red-300)",
  },
  music: {
    icon: "music",
    primary: "var(--color-fuchsia-400)",
    accent: "var(--color-fuchsia-500)",
    tertiary: "var(--color-fuchsia-300)",
  },
  podcast: {
    icon: "mic",
    primary: "var(--color-purple-400)",
    accent: "var(--color-purple-500)",
    tertiary: "var(--color-purple-300)",
  },
  gaming: {
    icon: "gamepad",
    primary: "var(--color-indigo-400)",
    accent: "var(--color-indigo-500)",
    tertiary: "var(--color-indigo-300)",
  },
  education: {
    icon: "graduation-cap",
    primary: "var(--color-blue-300)",
    accent: "var(--color-blue-600)",
    tertiary: "var(--color-blue-300)",
  },
  business: {
    icon: "briefcase",
    primary: "var(--color-stone-300)",
    accent: "var(--color-stone-500)",
    tertiary: "var(--color-stone-300)",
  },
  finance: {
    icon: "dollar-sign",
    primary: "var(--color-emerald-400)",
    accent: "var(--color-emerald-500)",
    tertiary: "var(--color-emerald-300)",
  },
  marketing: {
    icon: "megaphone",
    primary: "var(--color-rose-400)",
    accent: "var(--color-rose-500)",
    tertiary: "var(--color-rose-300)",
  },
  ecommerce: {
    icon: "shopping-cart",
    primary: "var(--color-teal-400)",
    accent: "var(--color-teal-500)",
    tertiary: "var(--color-teal-300)",
  },
  community: {
    icon: "users",
    primary: "var(--color-sky-300)",
    accent: "var(--color-sky-600)",
    tertiary: "var(--color-sky-300)",
  },
  relationships: {
    icon: "heart",
    primary: "var(--color-rose-300)",
    accent: "var(--color-rose-500)",
    tertiary: "var(--color-rose-300)",
  },
  health: {
    icon: "heart-pulse",
    primary: "var(--color-red-300)",
    accent: "var(--color-red-500)",
    tertiary: "var(--color-red-300)",
  },
  fitness: {
    icon: "dumbbell",
    primary: "var(--color-lime-400)",
    accent: "var(--color-lime-500)",
    tertiary: "var(--color-lime-300)",
  },
  sports: {
    icon: "trophy",
    primary: "var(--color-yellow-400)",
    accent: "var(--color-yellow-500)",
    tertiary: "var(--color-yellow-300)",
  },
  food: {
    icon: "utensils",
    primary: "var(--color-orange-300)",
    accent: "var(--color-orange-600)",
    tertiary: "var(--color-orange-300)",
  },
  nature: {
    icon: "leaf",
    primary: "var(--color-green-400)",
    accent: "var(--color-green-500)",
    tertiary: "var(--color-green-300)",
  },
  travel: {
    icon: "plane",
    primary: "var(--color-cyan-300)",
    accent: "var(--color-cyan-600)",
    tertiary: "var(--color-cyan-300)",
  },
  home: {
    icon: "house",
    primary: "var(--color-amber-400)",
    accent: "var(--color-amber-600)",
    tertiary: "var(--color-amber-300)",
  },
  automotive: {
    icon: "car",
    primary: "var(--color-red-400)",
    accent: "var(--color-zinc-500)",
    tertiary: "var(--color-red-300)",
  },
  parenting: {
    icon: "baby",
    primary: "var(--color-pink-300)",
    accent: "var(--color-pink-500)",
    tertiary: "var(--color-pink-300)",
  },
  pets: {
    icon: "paw-print",
    primary: "var(--color-amber-300)",
    accent: "var(--color-orange-500)",
    tertiary: "var(--color-amber-300)",
  },
  fashion: {
    icon: "shirt",
    primary: "var(--color-fuchsia-300)",
    accent: "var(--color-fuchsia-600)",
    tertiary: "var(--color-fuchsia-300)",
  },
  events: {
    icon: "calendar",
    primary: "var(--color-indigo-300)",
    accent: "var(--color-indigo-500)",
    tertiary: "var(--color-indigo-300)",
  },
  science: {
    icon: "flask",
    primary: "var(--color-teal-300)",
    accent: "var(--color-teal-600)",
    tertiary: "var(--color-teal-300)",
  },
  security: {
    icon: "shield",
    primary: "var(--color-emerald-300)",
    accent: "var(--color-emerald-600)",
    tertiary: "var(--color-emerald-300)",
  },
  tools: {
    icon: "wrench",
    primary: "var(--color-neutral-300)",
    accent: "var(--color-neutral-500)",
    tertiary: "var(--color-neutral-300)",
  },
  other: {
    icon: "lightbulb",
    primary: "var(--color-yellow-300)",
    accent: "var(--color-yellow-500)",
    tertiary: "var(--color-yellow-300)",
  },
} as const satisfies Record<string, BucketCategoryStyle>;

export type BucketCategory = keyof typeof BUCKET_CATEGORIES;

export const BUCKET_CATEGORY_NAMES = Object.keys(
  BUCKET_CATEGORIES,
) as BucketCategory[];

// Buckets made before categories existed, or with an unknown one.
export const DEFAULT_BUCKET_STYLE: BucketCategoryStyle = {
  icon: "folder",
  primary: "var(--color-green-500)",
  accent: "var(--color-green-500)",
  tertiary: "var(--color-green-300)",
};

export function isBucketCategory(value: unknown): value is BucketCategory {
  return typeof value === "string" && Object.hasOwn(BUCKET_CATEGORIES, value);
}

export function bucketStyle(category: unknown): BucketCategoryStyle {
  return isBucketCategory(category)
    ? BUCKET_CATEGORIES[category]
    : DEFAULT_BUCKET_STYLE;
}
