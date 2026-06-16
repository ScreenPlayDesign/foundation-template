/**
 * App.tsx — template landing page.
 * Replace with your event's pages; keep the data-testid attributes —
 * the SPD Playwright suite anchors its screenshot assertions to them.
 */
export default function App() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center gap-6 p-8">
      <h1 data-testid="app-title" className="text-4xl font-bold tracking-tight">
        Your Event Starts Here
      </h1>
      <p data-testid="app-tagline" className="text-slate-400 max-w-md text-center">
        Built on ScreenPlayDesign — Supabase backend, React frontend,
        deployed dev → staging → prod through Cloudflare Pages.
      </p>
      <span data-testid="app-status" className="rounded-full bg-sky-500/10 px-4 py-1 text-sm text-sky-400">
        template: ready
      </span>
    </main>
  )
}
