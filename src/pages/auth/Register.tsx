/**
 * Register.tsx
 * 
 * Registration page for new users.
 * Uses modern Shadcn UI components.
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router'
import { useSession } from '../../hooks/useSession'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card'
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail, User } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert'

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationError, setValidationError] = useState('')
  const [success, setSuccess] = useState(false)

  const { signUp, isAuthenticated, loading, error, clearError } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    return () => {
      clearError()
    }
  }, [clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError('')

    if (!fullName || !email || !password || !confirmPassword) {
      setValidationError('Semua field harus diisi')
      return
    }

    if (!email.includes('@')) {
      setValidationError('Email tidak valid')
      return
    }

    if (password.length < 6) {
      setValidationError('Password minimal 6 karakter')
      return
    }

    if (password !== confirmPassword) {
      setValidationError('Password tidak cocok')
      return
    }

    const success = await signUp(email, password, fullName)

    if (success) {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50/50 p-4 dark:bg-neutral-950/50">
        <div className="w-full max-w-[400px]">
          <Card className="border-green-200 shadow-xl dark:border-green-900">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-green-700 dark:text-green-400">Pendaftaran Berhasil!</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-sm text-neutral-600 dark:text-neutral-400">
              <p>Akun Anda telah berhasil dibuat. Silakan cek email Anda untuk verifikasi sebelum masuk.</p>
            </CardContent>
            <CardFooter className="justify-center">
              <Button asChild className="w-full bg-green-600 hover:bg-green-700">
                <Link to="/login">Masuk ke Akun</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50/50 p-4 dark:bg-neutral-950/50">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Buat Akun Baru</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Gabung untuk manajemen proyek yang lebih baik</p>
        </div>

        <Card className="border-neutral-200 shadow-xl dark:border-neutral-800">
          <CardHeader>
            <CardTitle>Daftar</CardTitle>
            <CardDescription>Isi formulir di bawah ini untuk membuat akun baru.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {(error || validationError) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {validationError || error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="fullName">Nama Lengkap</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-9"
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nama@perusahaan.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Ulangi password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-9"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mendaftar...
                  </>
                ) : (
                  'Daftar'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
            <p className="text-sm text-neutral-500">
              Sudah punya akun?{' '}
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400">
                Masuk
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
