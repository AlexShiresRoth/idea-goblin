import { updateSession } from "@/lib/auth/proxy";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api upload routes (large multipart bodies; auth is checked in the route)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|icon|apple-icon|opengraph-image|twitter-image|api/profile/upload-song-clip|api/profile/upload-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
