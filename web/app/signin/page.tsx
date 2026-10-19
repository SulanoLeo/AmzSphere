import { signIn } from "@/auth";

const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export default function SignInPage() {
  if (!googleConfigured) {
    return <main className="grid min-h-screen place-items-center bg-canvas p-5">
      <div className="rounded-md border border-line bg-white p-6">
        <h1 className="text-xl font-semibold text-indigo-950">AmzSphere Operations</h1>
        <p className="mt-2 text-sm text-muted">Sign-in is not configured.</p>
        <p className="mt-2 text-sm text-muted">Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in .env to enable sign-in.</p>
      </div>
    </main>;
  }

  return <main className="grid min-h-screen place-items-center bg-canvas p-5">
    <form action={async () => { "use server"; await signIn("google"); }} className="w-full max-w-sm rounded-md border border-line bg-white p-6">
      <h1 className="text-xl font-semibold text-indigo-950">AmzSphere Operations</h1>
      <p className="mt-2 text-sm text-muted">Sign in with your Gmail account to continue.</p>
      <button className="mt-6 h-10 w-full rounded-md bg-indigo-900 px-4 text-sm font-semibold text-white hover:bg-indigo-800" type="submit">Continue with Google</button>
    </form>
  </main>;
}