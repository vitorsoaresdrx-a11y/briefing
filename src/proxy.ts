import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parseAdminEmails } from "@/lib/admin-emails";

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLogin = pathname === "/admin/login";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    // Sem configuração não há como validar sessão: só a tela de login abre.
    if (isLogin) return NextResponse.next();
    return NextResponse.redirect(new URL("/admin/login?error=config", req.url));
  }

  const res = NextResponse.next();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        });
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = Boolean(
    user?.email && parseAdminEmails(process.env.ADMIN_EMAILS).includes(user.email.trim().toLowerCase()),
  );

  if (!isAdmin && !isLogin) {
    const dest = new URL("/admin/login", req.url);
    if (user) dest.searchParams.set("not-allowed", "1");
    return NextResponse.redirect(dest);
  }
  if (isAdmin && isLogin) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
