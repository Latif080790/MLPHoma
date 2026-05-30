import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router'
import { useSession } from '../../hooks/useSession'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthLayout } from '../../components/layouts/AuthLayout'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      setValidationError('Masukkan email dan password Anda')
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
    <AuthLayout>
      {/* Title */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-white">Masuk ke Akun</h1>
        <p className="mt-1 text-sm text-white/50">
          Masuk untuk lanjutkan ke Command Center
        </p>
      </div>

      {/* Error */}
      {(error || validationError) && (
        <Alert variant="destructive" className="mb-5 border-red-500/30 bg-red-500/10">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-300">
            {validationError || error}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-white/70">
            Email
          </Label>
          <Input
            id="email"
            placeholder="nama@perusahaan.com"
            type="email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            disabled={isLoading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 border-white/10 bg-[#16223A] text-white placeholder:text-white/30 focus-visible:border-[#F97316] focus-visible:ring-[#F97316]/20"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium text-white/70">
              Password
            </Label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-[#F97316] hover:text-[#FB923C] transition-colors"
            >
              Lupa kata sandi?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              placeholder="••••••••"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={isLoading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 border-white/10 bg-[#16223A] pr-10 text-white placeholder:text-white/30 focus-visible:border-[#F97316] focus-visible:ring-[#F97316]/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* CTA */}
        <Button
          type="submit"
          disabled={isLoading}
          className="mt-2 h-11 w-full bg-[#F97316] font-semibold text-white hover:bg-[#EA580C] focus-visible:ring-[#F97316]/40 disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Masuk...
            </>
          ) : (
            'Masuk'
          )}
        </Button>
      </form>

      {/* Register link */}
      <p className="mt-6 text-center text-sm text-white/40">
        Belum punya akun?{' '}
        <Link
          to="/register"
          className="font-medium text-[#F97316] hover:text-[#FB923C] transition-colors"
        >
          Daftar
        </Link>
      </p>
    </AuthLayout>
  )
}
