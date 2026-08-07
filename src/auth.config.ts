import type { NextAuthConfig } from "next-auth";

const authSecret = process.env.AUTH_SECRET?.trim();

if (!authSecret || authSecret.length < 32) {
  throw new Error(
    "AUTH_SECRET não foi configurado com um segredo forte. Gere um valor aleatório antes de iniciar o AgroZap.",
  );
}

const protectedPaths = [
  "/dashboard",
  "/talhoes",
  "/registros",
  "/estoque",
  "/equipe",
  "/propriedades",
] as const;

function isProtectedPath(pathname: string) {
  return protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Configuração que também pode ser carregada pelo Proxy. Ela faz apenas a
 * checagem otimista do JWT; a autorização com PostgreSQL fica nos layouts,
 * actions e services próximos aos dados.
 */
export const authConfig = {
  secret: authSecret,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    session({ session, token }) {
      if (session.user && typeof token.sub === "string") {
        session.user.id = token.sub;
      }
      return session;
    },
    authorized({ auth, request }) {
      if (!isProtectedPath(request.nextUrl.pathname)) return true;
      return Boolean(auth?.user?.id);
    },
  },
  providers: [],
} satisfies NextAuthConfig;
