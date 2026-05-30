/**
 * Register.tsx
 *
 * Registration page for new users.
 * Navy dark design system — NATA LABA v2.
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router'
import { useSession } from '../../hooks/useSession'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { AuthLayout } from '../../components/layouts/AuthLayout'

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [role, setRole] = useState('ENGINEER')
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

    const ok = await signUp(email, password, fullName, role)

    if (ok) {
      setSuccess(true)
    }
  }

  // ── Success State ────────────────────────────────────────────────────────
  if (success) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
            <CheckCircle2 className="h-7 w-7 text-green-400" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">Pendaftaran Berhasil!</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            Akun Anda telah berhasil dibuat. Silakan cek email Anda untuk verifikasi sebelum masuk.
          </p>
          <Button
            asChild
            className="mt-8 h-11 w-full bg-[#F97316] font-semibold text-white hover:bg-[#EA580C]"
          >
            <Link to="/login">Masuk ke Akun</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────
  return (
    <AuthLayout>
      {/* Title */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-white">Buat Akun</h1>
        <p className="mt-1 text-sm text-white/50">
          Daftarkan akun untuk mulai menggunakan MLPHoma
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nama Lengkap */}
        <div className="space-y-1.5">
          <Label htmlFor="fullName" className="text-sm font-medium text-white/70">
            Nama Lengkap
          </Label>
          <Input
            id="fullName"
            type="text"
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11 border-white/10 bg-[#16223A] text-white placeholder:text-white/30 focus-visible:border-[#F97316] focus-visible:ring-[#F97316]/20"
            disabled={loading}
            autoFocus
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-white/70">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="nama@perusahaan.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 border-white/10 bg-[#16223A] text-white placeholder:text-white/30 focus-visible:border-[#F97316] focus-visible:ring-[#F97316]/20"
            disabled={loading}
          />
        </div>

        {/* Role */}
        <div className="space-y-1.5">
          <Label htmlFor="role" className="text-sm font-medium text-white/70">
            Pilih Peran (Role)
          </Label>
          <Select value={role} onValueChange={setRole} disabled={loading}>
            <SelectTrigger
              id="role"
              className="h-11 w-full border-white/10 bg-[#16223A] text-white focus:ring-[#F97316]/20 data-[placeholder]:text-white/30"
            >
              <SelectValue placeholder="Pilih Role Anda..." />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#16223A] text-white">
              <SelectItem value="ENGINEER">Site Engineer</SelectItem>
              <SelectItem value="PROJECT_MANAGER">Project Manager</SelectItem>
              <SelectItem value="QC_ENGINEER">Quality Control</SelectItem>
              <SelectItem value="FINANCE">Finance / Procurement</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-white/70">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 border-white/10 bg-[#16223A] pr-10 text-white placeholder:text-white/30 focus-visible:border-[#F97316] focus-visible:ring-[#F97316]/20"
              disabled={loading}
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

        {/* Konfirmasi Password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-sm font-medium text-white/70">
            Konfirmasi Password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Ulangi password"
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
          className="mt-2 h-11 w-full bg-[#F97316] font-semibold text-white hover:bg-[#EA580C] focus-visible:ring-[#F97316]/40 disabled:opacity-60"
          disabled={loading}
        >
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

      {/* Login link */}
      <p className="mt-6 text-center text-sm text-white/40">
        Sudah punya akun?{' '}
        <Link
          to="/login"
          className="font-medium text-[#F97316] hover:text-[#FB923C] transition-colors"
        >
          Masuk
        </Link>
      </p>
    </AuthLayout>
  )
}
