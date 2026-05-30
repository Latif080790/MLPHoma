/**
 * ForgotPassword.tsx
 *
 * Password reset request page.
 * Navy dark design system — NATA LABA v2.
 */

import React, { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useSession } from '../../hooks/useSession'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { AuthLayout } from '../../components/layouts/AuthLayout'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [validationError, setValidationError] = useState('')
  const [success, setSuccess] = useState(false)

  const { resetPassword, loading, error, clearError } = useSession()

  useEffect(() => {
    return () => {
      clearError()
    }
  }, [clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError('')

    if (!email) {
      setValidationError('Email harus diisi')
      return
    }

    if (!email.includes('@')) {
      setValidationError('Email tidak valid')
      return
    }

    const ok = await resetPassword(email)

    if (ok) {
      setSuccess(true)
    }
  }

  return (
    <AuthLayout>
      {success ? (
        /* ── Success State (inline in form panel) ── */
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
            <CheckCircle2 className="h-7 w-7 text-green-400" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">Link Reset Terkirim!</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            Link reset dikirim ke email Anda. Silakan cek inbox untuk melanjutkan.
          </p>
          <Link
            to="/login"
            className="mt-8 text-sm font-medium text-[#F97316] hover:text-[#FB923C] transition-colors"
          >
            ← Kembali ke Login
          </Link>
        </div>
      ) : (
        /* ── Form ── */
        <>
          {/* Title */}
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-white">Lupa Kata Sandi?</h1>
            <p className="mt-1 text-sm text-white/50">
              Masukkan email Anda untuk menerima link reset.
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

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-white/70">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nama@perusahaan.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 border-white/10 bg-[#16223A] text-white placeholder:text-white/30 focus-visible:border-[#F97316] focus-visible:ring-[#F97316]/20"
                disabled={loading}
              />
            </div>

            {/* CTA */}
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-[#F97316] font-semibold text-white hover:bg-[#EA580C] focus-visible:ring-[#F97316]/40 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengirim...
                </>
              ) : (
                'Kirim Link Reset'
              )}
            </Button>
          </form>

          {/* Back link */}
          <p className="mt-6 text-center text-sm text-white/40">
            <Link
              to="/login"
              className="font-medium text-[#F97316] hover:text-[#FB923C] transition-colors"
            >
              ← Kembali ke Login
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
