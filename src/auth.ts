import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { authenticateCredentials } from "@/services/auth/credentials.service";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Telefone e senha",
      credentials: {
        phone: { label: "Telefone", type: "tel" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (
          typeof credentials.phone !== "string" ||
          typeof credentials.password !== "string"
        ) {
          return null;
        }

        return authenticateCredentials({
          phone: credentials.phone,
          password: credentials.password,
        });
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.sub === "string") {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
