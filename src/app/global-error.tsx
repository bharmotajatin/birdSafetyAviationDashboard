"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-xl rounded-xl border border-rose-200 bg-white p-6">
          <h2 className="text-xl font-bold text-rose-700">Something went wrong</h2>
          <p className="mt-2 text-sm text-slate-600">{error.message}</p>
          <button onClick={() => reset()} className="mt-4 rounded bg-[#1a2a5e] px-4 py-2 text-sm font-semibold text-white">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
