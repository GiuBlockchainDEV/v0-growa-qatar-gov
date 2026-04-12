'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Sprout, ArrowLeft, Mail, Lock, Activity } from 'lucide-react'

export default function Page() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push('/dashboard')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 data-grid opacity-20" />
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      
      <div className="relative z-10 flex min-h-screen">
        {/* Left side - branding */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-card/30 border-r border-border">
          <div>
            <Link href="/" className="flex items-center gap-3 text-foreground hover:text-primary transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back to Home</span>
            </Link>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <img 
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo512-dN5LxVKBkzU9yWpc5ROgvoTj7C4wM5.png" 
                alt="Growa" 
                className="h-14 w-14 drop-shadow-lg"
              />
            </div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              GROWA <span className="text-primary">QATAR</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md">
              Sovereign Agricultural Operations Platform. 
              Access real-time monitoring and analytics for Qatar's agricultural resources.
            </p>
            <div className="flex items-center gap-2 pt-4">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">System Operational</span>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Ministry of Municipality - State of Qatar
          </p>
        </div>

        {/* Right side - login form */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <img 
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo512-dN5LxVKBkzU9yWpc5ROgvoTj7C4wM5.png" 
                alt="Growa" 
                className="h-10 w-10"
              />
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                GROWA <span className="text-primary">QATAR</span>
              </h1>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Enter your credentials to access the platform
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="operator@growa.qa"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 bg-secondary/50 border-border focus:border-primary/50 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-foreground">
                      Password
                    </Label>
                    <Link href="/auth/error" className="text-xs text-primary hover:text-primary/80 transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-11 bg-secondary/50 border-border focus:border-primary/50 focus:ring-primary/30"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-primary" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </div>
                  ) : (
                    'Access Platform'
                  )}
                </Button>
              </form>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <Link href="/auth/sign-up" className="text-primary hover:text-primary/80 font-medium transition-colors">
                    Request Access
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
