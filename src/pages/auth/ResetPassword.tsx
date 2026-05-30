/**
 * ResetPassword.tsx
 *
 * Password reset completion page.
 * Users land here after clicking the reset link from their email.
 * Navy dark design system — NATA LABA v2.
 */

import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { authService } from '../../lib/authService'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthLayout } from '../../components/layouts/AuthLayout'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { session } = useAuthStore()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [verifying, setVerifying] = useState(true)

  // Effect to handle session recovery from URL hash
  useEffect(() => {
    const handleSessionRecovery = async () => {
      // If we already have a session, we're good
      if (session) {
        setVerifying(false)
        return
      }

      // Check URL hash for tokens (Supabase sends tokens in URL fragment)
      // URL format with BrowserRouter: /reset-password#access_token=TOKEN&refresh_token=TOKEN&...
      const hash = window.location.hash

      if (hash && hash.includes('access_token')) {
        try {
          // strip leading '#' for URLSearchParams
          const params = new URLSearchParams(hash.substring(1))
          const accessToken = params.get('access_token')
          const refreshToken = params.get('refresh_token')

          if (accessToken && refreshToken) {
            if (!supabase) {
              setError('Konfigurasi sistem tidak lengkap. Hubungi administrator.')
              return
            }

            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (error) throw error

            // Session set successfully
            setVerifying(false)
            return
          }
        } catch (err) {
          setError('Gagal memverifikasi link reset password. Link mungkin sudah kedaluwarsa.')
        }
      }

      // If we're here, we tried recovery and failed, or there was no token
      // Brief timeout to allow global authStore to initialize if it was just slow
      setTimeout(() => {
        const currentSession = useAuthStore.getState().session
        if (!currentSession) {
          setError('Sesi tidak ditemukan. Silakan minta link reset password baru.')
        }
        setVerifying(false)
      }, 2000)
    }

    handleSessionRecovery()
  }, [session])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError('')
    setError('')

    if (!newPassword || !confirmPassword) {
      setValidationError('Password harus diisi')
      return
    }

    if (newPassword.length < 6) {
      setValidationError('Password minimal 6 karakter')
      return
    }

    if (newPassword !== confirmPassword) {
      setValidationError('Password tidak cocok')
      return
    }

    setLoading(true)
    const { error: updateError } = await authService.updatePassword(newPassword)
    setLoading(false)

    if (updateError) {
      setError(updateError.message || 'Gagal memperbarui password')
      return
    }

    setSuccess(true)
  }

  return (
    <AuthLayout>
      {/* ── Verifying State ── */}
      {verifying ? (
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#16223A]">
            <Loader2 className="h-6 w-6 animate-spin text-[#F97316]" />
          </div>
          <p className="text-sm text-white/50">Memverifikasi link reset...</p>
        </div>
      ) : success ? (
        /* ── Success State ── */
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
            <CheckCircle2 className="h-7 w-7 text-green-400" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">Password Berhasil Diperbarui!</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            Password Anda telah berhasil diperbarui. Silakan masuk dengan password baru Anda.
          </p>
          <Button asChild className="mt-8 h-11 w-full bg-[#F97316] font-semibold text-white hover:bg-[#EA580C]">
            <Link to="/login">Masuk ke Akun</Link>
          </Button>
        </div>
      ) : (
        /* ── Form ── */
        <>
          {/* Title */}
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-white">Buat Password Baru</h1>
            <p className="mt-1 text-sm text-white/50">Masukkan password baru Anda di bawah.</p>
          </div>

          {/* Session/link error */}
          {error && (
            <Alert variant="destructive" className="mb-5 border-red-500/30 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                {error}{' '}
                <Link to="/forgot-password" className="underline">
                  Kirim ulang link reset
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* Validation error */}
          {validationError && (
            <Alert variant="destructive" className="mb-5 border-red-500/30 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">{validationError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Password Baru */}
            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-sm font-medium text-white/70">
                Password Baru
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  name="newPassword"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Minimal 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 border-white/10 bg-[#16223A] pr-10 text-white placeholder:text-white/30 focus-visible:border-[#F97316] focus-visible:ring-[#F97316]/20"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  tabIndex={-1}
                  aria-label={showNew ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Konfirmasi Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-white/70">
                Konfirmasi Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Ulangi password baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 border-white/10 bg-[#16223A] pr-10 text-white placeholder:text-white/30 focus-visible:border-[#F97316] focus-visible:ring-[#F97316]/20"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* CTA */}
            <Button
              type="submit"
              disabled={loading || !!error}
              className="h-11 w-full bg-[#F97316] font-semibold text-white hover:bg-[#EA580C] focus-visible:ring-[#F97316]/40 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Password Baru'
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
