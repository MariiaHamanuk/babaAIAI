type Props = { searchParams: Promise<{ from?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        action="/api/login"
        method="POST"
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
      >
        <h1 className="mb-1 text-xl font-semibold tracking-tight">
          Portfolio Health Dashboard
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Enter the access password to continue.
        </p>
        <input
          type="password"
          name="password"
          autoFocus
          required
          className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
          placeholder="Password"
        />
        {sp.from ? (
          <input type="hidden" name="from" value={sp.from} />
        ) : null}
        {sp.error ? (
          <p className="mt-3 text-sm text-red-600">Wrong password.</p>
        ) : null}
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
