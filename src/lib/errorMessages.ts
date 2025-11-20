/**
 * Error Message Mapping System
 * 
 * Provides user-friendly error messages with actionable guidance.
 * Maps technical errors to human-readable messages with recovery suggestions.
 * 
 * @module errorMessages
 */

export interface ErrorMessage {
  title: string
  message: string
  action?: string
  severity?: 'error' | 'warning' | 'info'
}

export type ErrorCategory = 
  | 'validation'
  | 'network'
  | 'auth'
  | 'permission'
  | 'notFound'
  | 'conflict'
  | 'server'
  | 'client'
  | 'calculation'
  | 'data'
  | 'unknown'

/**
 * Error message templates organized by category
 */
export const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  // Validation Errors
  'validation.required': {
    title: 'Data Wajib Diisi',
    message: 'Beberapa field yang wajib diisi masih kosong.',
    action: 'Periksa kembali formulir dan lengkapi data yang diperlukan.',
    severity: 'warning',
  },
  'validation.invalid_format': {
    title: 'Format Data Tidak Valid',
    message: 'Format data yang Anda masukkan tidak sesuai.',
    action: 'Pastikan format data sesuai dengan petunjuk yang diberikan.',
    severity: 'warning',
  },
  'validation.out_of_range': {
    title: 'Nilai Di Luar Batas',
    message: 'Nilai yang dimasukkan berada di luar rentang yang diperbolehkan.',
    action: 'Masukkan nilai dalam rentang yang valid.',
    severity: 'warning',
  },
  'validation.duplicate': {
    title: 'Data Duplikat',
    message: 'Data yang Anda masukkan sudah ada dalam sistem.',
    action: 'Gunakan data yang berbeda atau edit data yang sudah ada.',
    severity: 'warning',
  },

  // Network Errors
  'network.offline': {
    title: 'Koneksi Terputus',
    message: 'Tidak ada koneksi internet. Aplikasi bekerja dalam mode offline.',
    action: 'Periksa koneksi internet Anda dan coba lagi.',
    severity: 'error',
  },
  'network.timeout': {
    title: 'Waktu Habis',
    message: 'Permintaan memakan waktu terlalu lama.',
    action: 'Periksa koneksi Anda dan coba lagi.',
    severity: 'error',
  },
  'network.failed': {
    title: 'Koneksi Gagal',
    message: 'Tidak dapat terhubung ke server.',
    action: 'Pastikan Anda terhubung ke internet dan server dapat diakses.',
    severity: 'error',
  },
  'network.slow': {
    title: 'Koneksi Lambat',
    message: 'Koneksi internet Anda sangat lambat.',
    action: 'Pertimbangkan untuk menggunakan koneksi yang lebih stabil.',
    severity: 'warning',
  },

  // Authentication Errors
  'auth.unauthorized': {
    title: 'Sesi Berakhir',
    message: 'Sesi Anda telah berakhir. Silakan login kembali.',
    action: 'Login ulang untuk melanjutkan.',
    severity: 'error',
  },
  'auth.invalid_credentials': {
    title: 'Login Gagal',
    message: 'Username atau password yang Anda masukkan salah.',
    action: 'Periksa kembali kredensial Anda atau reset password.',
    severity: 'error',
  },
  'auth.token_expired': {
    title: 'Token Kedaluwarsa',
    message: 'Token autentikasi Anda sudah tidak berlaku.',
    action: 'Silakan login ulang untuk mendapatkan token baru.',
    severity: 'error',
  },
  'auth.account_locked': {
    title: 'Akun Terkunci',
    message: 'Akun Anda dikunci karena terlalu banyak percobaan login gagal.',
    action: 'Hubungi administrator atau tunggu beberapa saat.',
    severity: 'error',
  },

  // Permission Errors
  'permission.denied': {
    title: 'Akses Ditolak',
    message: 'Anda tidak memiliki izin untuk melakukan tindakan ini.',
    action: 'Hubungi administrator untuk mendapatkan akses.',
    severity: 'error',
  },
  'permission.read_only': {
    title: 'Mode Baca Saja',
    message: 'Anda hanya memiliki akses baca untuk data ini.',
    action: 'Minta izin edit dari administrator jika diperlukan.',
    severity: 'warning',
  },

  // Not Found Errors
  'notfound.resource': {
    title: 'Data Tidak Ditemukan',
    message: 'Data yang Anda cari tidak dapat ditemukan.',
    action: 'Periksa kembali atau coba refresh halaman.',
    severity: 'error',
  },
  'notfound.page': {
    title: 'Halaman Tidak Ditemukan',
    message: 'Halaman yang Anda cari tidak ada.',
    action: 'Kembali ke beranda atau periksa URL.',
    severity: 'error',
  },

  // Conflict Errors
  'conflict.version': {
    title: 'Konflik Data',
    message: 'Data telah diubah oleh pengguna lain.',
    action: 'Refresh halaman dan coba lagi dengan data terbaru.',
    severity: 'error',
  },
  'conflict.concurrent': {
    title: 'Perubahan Bersamaan',
    message: 'Beberapa pengguna mengubah data yang sama secara bersamaan.',
    action: 'Koordinasikan dengan tim atau gunakan data terbaru.',
    severity: 'warning',
  },

  // Server Errors
  'server.internal': {
    title: 'Kesalahan Server',
    message: 'Terjadi kesalahan di server.',
    action: 'Coba lagi nanti atau hubungi support jika masalah berlanjut.',
    severity: 'error',
  },
  'server.maintenance': {
    title: 'Dalam Pemeliharaan',
    message: 'Server sedang dalam pemeliharaan.',
    action: 'Coba lagi dalam beberapa saat.',
    severity: 'info',
  },
  'server.overload': {
    title: 'Server Sibuk',
    message: 'Server sedang mengalami beban tinggi.',
    action: 'Tunggu beberapa saat dan coba lagi.',
    severity: 'warning',
  },

  // Client Errors
  'client.invalid_request': {
    title: 'Permintaan Tidak Valid',
    message: 'Permintaan Anda tidak dapat diproses.',
    action: 'Periksa data yang Anda kirim dan coba lagi.',
    severity: 'error',
  },
  'client.rate_limit': {
    title: 'Terlalu Banyak Permintaan',
    message: 'Anda membuat terlalu banyak permintaan dalam waktu singkat.',
    action: 'Tunggu beberapa saat sebelum mencoba lagi.',
    severity: 'warning',
  },

  // Calculation Errors
  'calculation.invalid_input': {
    title: 'Input Perhitungan Tidak Valid',
    message: 'Data yang digunakan untuk perhitungan tidak valid.',
    action: 'Periksa data input dan pastikan semua nilai benar.',
    severity: 'error',
  },
  'calculation.division_by_zero': {
    title: 'Pembagian dengan Nol',
    message: 'Terjadi pembagian dengan nol dalam perhitungan.',
    action: 'Periksa nilai-nilai yang digunakan dalam perhitungan.',
    severity: 'error',
  },
  'calculation.overflow': {
    title: 'Nilai Terlalu Besar',
    message: 'Hasil perhitungan melebihi batas maksimum.',
    action: 'Gunakan nilai input yang lebih kecil.',
    severity: 'error',
  },
  'calculation.circular_dependency': {
    title: 'Dependensi Melingkar',
    message: 'Terdeteksi dependensi melingkar dalam perhitungan.',
    action: 'Periksa hubungan antar task dan hapus siklus.',
    severity: 'error',
  },

  // Data Errors
  'data.corrupted': {
    title: 'Data Rusak',
    message: 'Data yang dimuat tampaknya rusak atau tidak lengkap.',
    action: 'Coba muat ulang atau gunakan backup jika tersedia.',
    severity: 'error',
  },
  'data.import_failed': {
    title: 'Import Gagal',
    message: 'Gagal mengimpor data dari file.',
    action: 'Periksa format file dan coba lagi.',
    severity: 'error',
  },
  'data.export_failed': {
    title: 'Export Gagal',
    message: 'Gagal mengekspor data.',
    action: 'Periksa izin file dan ruang penyimpanan yang tersedia.',
    severity: 'error',
  },
  'data.sync_failed': {
    title: 'Sinkronisasi Gagal',
    message: 'Gagal menyinkronkan data dengan server.',
    action: 'Periksa koneksi dan coba sinkronisasi ulang.',
    severity: 'error',
  },

  // Unknown/Default
  'unknown.error': {
    title: 'Terjadi Kesalahan',
    message: 'Terjadi kesalahan yang tidak terduga.',
    action: 'Coba refresh halaman atau hubungi support.',
    severity: 'error',
  },
}

/**
 * Get error message by code
 */
export function getErrorMessage(code: string): ErrorMessage {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES['unknown.error']
}

/**
 * Get error category from error code
 */
export function getErrorCategory(code: string): ErrorCategory {
  const category = code.split('.')[0] as ErrorCategory
  const validCategories: ErrorCategory[] = [
    'validation', 'network', 'auth', 'permission', 'notFound',
    'conflict', 'server', 'client', 'calculation', 'data'
  ]
  return validCategories.includes(category) ? category : 'unknown'
}

/**
 * Format error for display
 */
export function formatError(error: Error | string, code?: string): ErrorMessage {
  // If error code is provided, use mapped message
  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code]
  }

  // Try to extract error code from error message
  const errorMessage = typeof error === 'string' ? error : error.message
  const codeMatch = errorMessage.match(/\[([a-z]+\.[a-z_]+)\]/i)
  
  if (codeMatch && ERROR_MESSAGES[codeMatch[1]]) {
    return ERROR_MESSAGES[codeMatch[1]]
  }

  // Detect error type from message patterns
  const message = errorMessage.toLowerCase()

  if (message.includes('network') || message.includes('fetch')) {
    return ERROR_MESSAGES['network.failed']
  }
  if (message.includes('timeout')) {
    return ERROR_MESSAGES['network.timeout']
  }
  if (message.includes('unauthorized') || message.includes('401')) {
    return ERROR_MESSAGES['auth.unauthorized']
  }
  if (message.includes('forbidden') || message.includes('403')) {
    return ERROR_MESSAGES['permission.denied']
  }
  if (message.includes('not found') || message.includes('404')) {
    return ERROR_MESSAGES['notfound.resource']
  }
  if (message.includes('conflict') || message.includes('409')) {
    return ERROR_MESSAGES['conflict.version']
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return ERROR_MESSAGES['validation.invalid_format']
  }
  if (message.includes('required')) {
    return ERROR_MESSAGES['validation.required']
  }

  // Default unknown error
  return {
    ...ERROR_MESSAGES['unknown.error'],
    message: errorMessage,
  }
}

/**
 * Create custom error with code
 */
export class AppError extends Error {
  code: string
  severity: 'error' | 'warning' | 'info'
  action?: string

  constructor(code: string, customMessage?: string) {
    const errorMsg = ERROR_MESSAGES[code] || ERROR_MESSAGES['unknown.error']
    super(customMessage || errorMsg.message)
    
    this.name = 'AppError'
    this.code = code
    this.severity = errorMsg.severity || 'error'
    this.action = errorMsg.action
  }

  toErrorMessage(): ErrorMessage {
    const baseMessage = ERROR_MESSAGES[this.code] || ERROR_MESSAGES['unknown.error']
    return {
      title: baseMessage.title,
      message: this.message,
      action: this.action || baseMessage.action,
      severity: this.severity,
    }
  }
}

/**
 * HTTP Status Code to Error Code mapping
 */
export const HTTP_STATUS_TO_ERROR: Record<number, string> = {
  400: 'client.invalid_request',
  401: 'auth.unauthorized',
  403: 'permission.denied',
  404: 'notfound.resource',
  409: 'conflict.version',
  429: 'client.rate_limit',
  500: 'server.internal',
  502: 'server.overload',
  503: 'server.maintenance',
  504: 'network.timeout',
}

/**
 * Get error message from HTTP status code
 */
export function getHttpErrorMessage(status: number): ErrorMessage {
  const code = HTTP_STATUS_TO_ERROR[status] || 'unknown.error'
  return getErrorMessage(code)
}
