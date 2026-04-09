import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-foreground">Growa Qatar</h1>
        <p className="text-muted-foreground">
          Sovereign Agricultural Operations Platform
        </p>
        <div className="pt-4 space-y-2">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Dashboard
          </Link>
          <p className="text-xs text-muted-foreground/60 mt-4">
            Database integration pending - connect Supabase via v0 Settings
          </p>
        </div>
      </div>
    </main>
  )
}
