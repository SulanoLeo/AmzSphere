import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const googleProvider =
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      })]
    : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: googleProvider,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/signin" },
});