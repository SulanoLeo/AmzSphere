import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

const keycloakProvider =
  process.env.AUTH_KEYCLOAK_ID && process.env.AUTH_KEYCLOAK_SECRET && process.env.AUTH_KEYCLOAK_ISSUER
    ? [Keycloak({
        clientId: process.env.AUTH_KEYCLOAK_ID,
        clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
        issuer: process.env.AUTH_KEYCLOAK_ISSUER,
      })]
    : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: keycloakProvider,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/signin" },
});