import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawError = params.error;
  const error = Array.isArray(rawError) ? rawError[0] : rawError;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4">
      <div className="w-full rounded-xl border border-[#e2e8f0] bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-[#1a2a5e]">Authentication Error</h1>
        <p className="mt-2 text-sm text-slate-600">
          {error ? `Unable to continue: ${error}` : "Unable to continue. Please sign in again."}
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex rounded-md bg-[#1a2a5e] px-4 py-2 text-sm font-semibold text-[#d4af37]"
        >
          Back to Login
        </Link>
      </div>
    </main>
  );
}
