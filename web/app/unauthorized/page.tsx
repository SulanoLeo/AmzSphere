import Link from "next/link";

export default function UnauthorizedPage() {
  return <main className="grid min-h-screen place-items-center bg-canvas p-5">
    <section className="w-full max-w-md rounded-md border border-line bg-white p-6">
      <h1 className="text-xl font-semibold text-indigo-950">Access not authorized</h1>
      <p className="mt-2 text-sm leading-6 text-muted">This signed-in account is not on the AmzSphere workspace allowlist.</p>
      <Link href="/api/auth/signout" className="mt-5 inline-block text-sm font-semibold text-teal-700 underline">Sign out</Link>
    </section>
  </main>;
}