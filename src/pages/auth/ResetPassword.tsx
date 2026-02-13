/**
 * ResetPassword.tsx
 * 
 * Password reset completion page.
 * Users land here after clicking the reset link from their email.
 * Supports dark mode and Indonesian language.
 */

import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { authService } from '../../lib/authService'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { session } = useAuthStore()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

      // Check URL hash for tokens (handling HashRouter double hash issue)
      // URL format might be: http://.../#/reset-password#access_token=...
      const hash = window.location.hash

      if (hash && hash.includes('access_token')) {
        try {
          // Extract tokens manualy
          const params = new URLSearchParams(hash.substring(hash.indexOf('#', 1) + 1)) // Get part after second # if exists, or just process

          // Fallback: regex match if URLSearchParams fails on complex hash
          const accessTokenMatch = hash.match(/access_token=([^&]+)/)
          const refreshTokenMatch = hash.match(/refresh_token=([^&]+)/)

          const accessToken = accessTokenMatch ? accessTokenMatch[1] : params.get('access_token')
          const refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : params.get('refresh_token')

          if (accessToken && refreshToken) {
            if (!supabase) {
              console.error("Supabase client not initialized")
              setError("Konfigurasi sistem tidak lengkap. Hubungi administrator.")
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
          console.error("Manual session recovery failed:", err)
          setError("Gagal memverifikasi link reset password. Link mungkin sudah kedaluwarsa.")
        }
      }

      // If we're here, we tried recovery and failed, or there was no token
      // Brief timeout to allow global authStore to initialize if it was just slow
      setTimeout(() => {
        const currentSession = useAuthStore.getState().session
        if (!currentSession) {
          setError("Sesi tidak ditemukan. Silakan minta link reset password baru.")
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

    // Validation
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

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12 dark:bg-neutral-950 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="rounded-md bg-green-50 p-6 text-center dark:bg-green-900/20">
            <h2 className="text-2xl font-bold text-green-800 dark:text-green-400">
              Password Berhasil Diperbarui!
            </h2>
            <p className="mt-4 text-sm text-green-700 dark:text-green-300">
              Password Anda telah berhasil diperbarui. Silakan masuk dengan password baru Anda.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
            >
              Masuk ke Akun
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12 dark:bg-neutral-950 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">Memverifikasi link...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12 dark:bg-neutral-950 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Reset Password
          </h2>
          <p className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
            Masukkan password baru Anda
          </p>
        </div>

        {error ? (
          <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20 text-center">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-400">{error}</h3>
            <div className="mt-4">
              <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                Kirim ulang link reset
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="newPassword" className="sr-only">
                  Password Baru
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="relative block w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 placeholder-neutral-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-400 sm:text-sm"
                  placeholder="Password Baru (minimal 6 karakter)"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="sr-only">
                  Konfirmasi Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="relative block w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 placeholder-neutral-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-400 sm:text-sm"
                  placeholder="Konfirmasi Password"
                  disabled={loading}
                />
              </div>
            </div>

            {validationError && (
              <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                      {validationError}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-offset-neutral-900"
              >
                {loading ? 'Memproses...' : 'Perbarui Password'}
              </button>
            </div>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Kembali ke halaman login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
