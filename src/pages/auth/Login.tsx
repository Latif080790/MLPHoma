import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router'
import { useSession } from '../../hooks/useSession'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { AlertCircle, ArrowRight, CheckCircle2, DraftingCompass, HardHat, Loader2, Lock, Mail } from 'lucide-react'
import { toast } from 'sonner'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [validationError, setValidationError] = useState('')

  const { signIn, isAuthenticated, error, clearError } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname || '/'

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from])

  useEffect(() => {
    clearError()
    return () => clearError()
  }, [])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setValidationError('')
    setIsLoading(true)

    if (!email || !password) {
      setValidationError('Please enter your email and password')
      setIsLoading(false)
      return
    }

    try {
      await signIn(email, password)
    } catch (err) {
      // Error handled by session
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container relative h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">

      {/* Left Column: Brand Panel */}
      <div className="relative hidden h-full flex-col p-10 text-white lg:flex dark:border-r overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #7c2d12 100%)' }} />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative z-20 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl shadow-lg text-white"
            style={{ background: 'linear-gradient(135deg, #1d5fcc, #f97316)' }}
          >
            <HardHat size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight tracking-tight">NATA LABA</span>
            <span className="text-xs font-semibold tracking-wider text-slate-400">Construction Suite</span>
          </div>
        </div>

        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg leading-relaxed">
              &ldquo;This platform has completely transformed how we manage our project estimates and timelines. The precision and speed are unmatched.&rdquo;
            </p>
            <footer className="text-sm text-orange-200">Achmad Latif, Project Manager</footer>
          </blockquote>
        </div>
      </div>

      {/* Right Column: Login Form */}
      <div className="lg:p-8 border-t-4" style={{ borderTopColor: '#f97316' }}>
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">

          <div className="flex flex-col space-y-2 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                style={{ background: 'linear-gradient(135deg, #1d5fcc, #f97316)' }}
              >
                <DraftingCompass size={14} />
              </div>
              <span className="text-base font-bold text-foreground">NATA LABA</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access your dashboard
            </p>
          </div>

          <form onSubmit={onSubmit}>
            <div className="grid gap-4">
              {(error || validationError) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError || error}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    placeholder="name@company.com"
                    type="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    disabled={isLoading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 bg-neutral-50 dark:bg-neutral-900/50"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    placeholder="••••••••"
                    type="password"
                    autoComplete="current-password"
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 bg-neutral-50 dark:bg-neutral-900/50"
                  />
                </div>
              </div>

              <Button
                disabled={isLoading}
                className="mt-2 w-full group text-white font-semibold"
                style={{ backgroundColor: '#f97316' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#ea580c')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f97316')}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" disabled={isLoading} onClick={() => toast.info('Demo only')}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Demo Acct
            </Button>
            <Button variant="outline" asChild>
              <Link to="/register">Create Account</Link>
            </Button>
          </div>

          <p className="px-8 text-center text-sm text-muted-foreground">
            By clicking continue, you agree to our{' '}
            <Link to="/terms" className="underline underline-offset-4 hover:text-primary">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="underline underline-offset-4 hover:text-primary">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
