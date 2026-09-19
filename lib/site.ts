export const siteConfig = {
  name: "Idea Goblin",
  tagline: "Capture, sort, and stay grounded with your ideas.",
  description:
    "Idea Goblin helps you capture ideas, sort them into buckets, and stay grounded instead of chasing every new thought.",
};

export function getSiteUrl() {
  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv && !fromEnv.includes("localhost")) {
    return fromEnv;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return fromEnv ?? "http://localhost:3000";
}
