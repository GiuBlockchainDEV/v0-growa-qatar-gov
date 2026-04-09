import Link from 'next/link'

export default function SignUpSuccessPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-5xl">✅</div>
        <h1 className="text-3xl font-bold text-foreground">Account Created</h1>
        <p className="text-muted-foreground">
          Your account has been successfully created. Please check your email to verify your account.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors mt-4"
        >
          Go to Sign In
        </Link>
      </div>
    </main>
  )
}
