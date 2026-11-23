import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/manifest.webmanifest", "/api/keepalive", "/api/stash", "/api/version", "/icons", "/favicon"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, maxAge: options?.maxAge ?? 60 * 60 * 24 * 365 }),
          );
        },
      },
    },
  );

  const { data } = await sb.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path.startsWith(p));

  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const ok = data.user && (!allowed.length || allowed.includes((data.user.email ?? "").toLowerCase()));

  // shortcut payload while signed out: keep it through the login page
  if (!ok && path.startsWith("/i/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?page=${encodeURIComponent(path.slice(3))}`;
    return NextResponse.redirect(url);
  }
  if (!ok && !isPublic) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (ok && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/plan";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png|.*\\.(?:png|svg|jpg|webp)$).*)"],
};
