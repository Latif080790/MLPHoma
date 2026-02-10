/**
 * ForgotPassword.tsx
 * 
 * Password reset request page.
 * Supports dark mode and Indonesian language.
 */

import React, { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useSession } from '../../hooks/useSession'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [validationError, setValidationError] = useState('')
  const [success, setSuccess] = useState(false)

  const { resetPassword, loading, error, clearError } = useSession()

  // Clear errors when component unmounts
  useEffect(() => {
    return () => {
      clearError()
    }
  }, [clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError('')

    // Validation
    if (!email) {
      setValidationError('Email harus diisi')
      return
    }

    if (!email.includes('@')) {
      setValidationError('Email tidak valid')
      return
    }

    const success = await resetPassword(email)

    // Show success message if reset succeeded
    if (success) {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12 dark:bg-neutral-950 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="rounded-md bg-green-50 p-6 text-center dark:bg-green-900/20">
            <h2 className="text-2xl font-bold text-green-800 dark:text-green-400">
              Email Terkirim!
            </h2>
            <p className="mt-4 text-sm text-green-700 dark:text-green-300">
              Kami telah mengirim link reset password ke email Anda. Silakan cek inbox Anda.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
            >
              Kembali ke Halaman Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12 dark:bg-neutral-950 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Lupa Password?
          </h2>
          <p className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
            Masukkan email Anda dan kami akan mengirim link untuk reset password.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="sr-only">
              Alamat Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="relative block w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 placeholder-neutral-500 focus:z-10 focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder-neutral-400 sm:text-sm"
              placeholder="Alamat Email"
              disabled={loading}
            />
          </div>

          {(error || validationError) && (
            <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                    {validationError || error}
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
              {loading ? 'Mengirim...' : 'Kirim Link Reset'}
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
      </div>
    </div>
  )
}
