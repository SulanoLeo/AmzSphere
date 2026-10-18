import { signIn } from "@/auth";

const keycloakConfigured = Boolean(process.env.AUTH_KEYCLOAK_ID && process.env.AUTH_KEYCLOAK_SECRET && process.env.AUTH_KEYCLOAK_ISSUER);

export default function SignInPage() {
  if (!keycloakConfigured) {
    return <main className="grid min-h-screen place-items-center bg-canvas p-5">
      <div className="rounded-md border border-line bg-white p-6">
        <h1 className="text-xl font-semibold text-indigo-950">AmzSphere Operations</h1>
        <p className="mt-2 text-sm text-muted">Sign-in is not configured.</p>
        <p className="mt-2 text-sm text-muted">Set AUTH_KEYCLOAK_ID, AUTH_KEYCLOAK_SECRET, and AUTH_KEYCLOAK_ISSUER in .env to enable SSO.</p>
      </div>
    </main>;
  }

  return <main className="grid min-h-screen place-items-center bg-canvas p-5">
    <form action={async () => { "use server"; await signIn("keycloak"); }} className="w-full max-w-sm rounded-md border border-line bg-white p-6">
      <h1 className="text-xl font-semibold text-indigo-950">AmzSphere Operations</h1>
      <p className="mt-2 text-sm text-muted">Sign in with your organization account to continue.</p>
      <button className="mt-6 h-10 w-full rounded-md bg-indigo-900 px-4 text-sm font-semibold text-white hover:bg-indigo-800" type="submit">Continue with SSO</button>
    </form>
  </main>;
}