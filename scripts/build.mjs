import * as esbuild from 'esbuild'
import { rimraf } from 'rimraf'
import stylePlugin from 'esbuild-style-plugin'
import autoprefixer from 'autoprefixer'
import tailwindcss from 'tailwindcss'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const args = process.argv.slice(2)
const isProd = args[0] === '--production'

await rimraf('dist')

// Load environment variables from .env.local if exists
let envVars = {}
try {
  const envPath = resolve('.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const [key, ...valueParts] = trimmed.split('=')
    if (key && valueParts.length) {
      envVars[key.trim()] = valueParts.join('=').trim()
    }
  })
  console.log('✓ Loaded .env.local')
} catch (e) {
  console.log('⚠ No .env.local found, using process.env fallback')
}

// Merge with process.env and create define object
const define = {}
Object.keys(envVars).forEach(key => {
  define[`process.env.${key}`] = JSON.stringify(envVars[key])
})
// Fallback: if not in .env.local, use process.env
if (!define['process.env.VITE_SUPABASE_URL'] && process.env.VITE_SUPABASE_URL) {
  define['process.env.VITE_SUPABASE_URL'] = JSON.stringify(process.env.VITE_SUPABASE_URL)
}
if (!define['process.env.VITE_SUPABASE_ANON_KEY'] && process.env.VITE_SUPABASE_ANON_KEY) {
  define['process.env.VITE_SUPABASE_ANON_KEY'] = JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY)
}

/**
 * @type {esbuild.BuildOptions}
 */
const esbuildOpts = {
  color: true,
  entryPoints: ['src/main.tsx', 'index.html'],
  outdir: 'dist',
  entryNames: '[name]',
  write: true,
  bundle: true,
  format: 'iife',
  sourcemap: isProd ? false : 'linked',
  minify: isProd,
  treeShaking: true,
  jsx: 'automatic',
  loader: {
    '.html': 'copy',
    '.png': 'file',
  },
  define,
  plugins: [
    stylePlugin({
      postcss: {
        plugins: [tailwindcss, autoprefixer],
      },
    }),
  ],
}

if (isProd) {
  await esbuild.build(esbuildOpts)
} else {
  const ctx = await esbuild.context(esbuildOpts)
  await ctx.watch()
  const { hosts, port } = await ctx.serve()
  console.log(`Running on:`)
  hosts.forEach((host) => {
    console.log(`http://${host}:${port}`)
  })
}
