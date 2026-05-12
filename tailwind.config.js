/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{html,js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        /* NATA LABA Brand Tokens — V2 Evaluation "Opsi A Applied" */
        'nl-orange': '#f97316',
        'nl-orange-dark': '#ea580c',
        'nl-orange-pale': '#ffedd5',
        'nl-orange-border': '#fed7aa',
        'nl-blue': '#1d5fcc',
        'nl-blue-dark': '#153fa8',
        'nl-blue-pale': '#dbeafe',
        'nl-sidebar': '#0f172a',
        'nl-sidebar-active': '#431407',
        /* MLPHoma Design Token System — Semantic Colors */
        surface: {
          canvas: 'hsl(var(--color-surface-canvas))',
          page: 'hsl(var(--color-surface-page))',
          panel: 'hsl(var(--color-surface-panel))',
          'panel-hover': 'hsl(var(--color-surface-panel-hover))',
          'panel-active': 'hsl(var(--color-surface-panel-active))',
          subtle: 'hsl(var(--color-surface-subtle))',
          elevated: 'hsl(var(--color-surface-elevated))',
          inverse: 'hsl(var(--color-surface-inverse))',
        },
        'text-semantic': {
          primary: 'hsl(var(--color-text-primary))',
          secondary: 'hsl(var(--color-text-secondary))',
          tertiary: 'hsl(var(--color-text-tertiary))',
          disabled: 'hsl(var(--color-text-disabled))',
          inverse: 'hsl(var(--color-text-inverse))',
          link: 'hsl(var(--color-text-link))',
        },
        'border-semantic': {
          default: 'hsl(var(--color-border-default))',
          subtle: 'hsl(var(--color-border-subtle))',
          strong: 'hsl(var(--color-border-strong))',
          focus: 'hsl(var(--color-border-focus))',
        },
        status: {
          'success-fg': 'hsl(var(--color-status-success-fg))',
          'success-bg': 'hsl(var(--color-status-success-bg))',
          'warning-fg': 'hsl(var(--color-status-warning-fg))',
          'warning-bg': 'hsl(var(--color-status-warning-bg))',
          'danger-fg': 'hsl(var(--color-status-danger-fg))',
          'danger-bg': 'hsl(var(--color-status-danger-bg))',
          'info-fg': 'hsl(var(--color-status-info-fg))',
          'info-bg': 'hsl(var(--color-status-info-bg))',
        },
        category: {
          material: 'hsl(var(--color-category-material))',
          labor: 'hsl(var(--color-category-labor))',
          equipment: 'hsl(var(--color-category-equipment))',
          subcon: 'hsl(var(--color-category-subcon))',
          document: 'hsl(var(--color-category-document))',
          finance: 'hsl(var(--color-category-finance))',
          risk: 'hsl(var(--color-category-risk))',
          schedule: 'hsl(var(--color-category-schedule))',
        },
      },
      spacing: {
        'space-0': 'var(--space-0)',
        'space-1': 'var(--space-1)',
        'space-2': 'var(--space-2)',
        'space-3': 'var(--space-3)',
        'space-4': 'var(--space-4)',
        'space-5': 'var(--space-5)',
        'space-6': 'var(--space-6)',
        'space-8': 'var(--space-8)',
        'space-10': 'var(--space-10)',
        'space-12': 'var(--space-12)',
        'space-16': 'var(--space-16)',
        'space-20': 'var(--space-20)',
        'space-24': 'var(--space-24)',
        'padding-xs': 'var(--padding-xs)',
        'padding-sm': 'var(--padding-sm)',
        'padding-md': 'var(--padding-md)',
        'padding-lg': 'var(--padding-lg)',
        'padding-xl': 'var(--padding-xl)',
        'sidebar-expanded': 'var(--size-sidebar-expanded)',
        'sidebar-collapsed': 'var(--size-sidebar-collapsed)',
        'inspector-default': 'var(--size-inspector-default)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'radius-xs': 'var(--radius-xs)',
        'radius-sm': 'var(--radius-sm)',
        'radius-md': 'var(--radius-md)',
        'radius-lg': 'var(--radius-lg)',
        'radius-full': 'var(--radius-full)',
      },
      fontSize: {
        'size-11': 'var(--font-size-11)',
        'size-12': 'var(--font-size-12)',
        'size-13': 'var(--font-size-13)',
        'size-14': 'var(--font-size-14)',
        'size-16': 'var(--font-size-16)',
        'size-18': 'var(--font-size-18)',
        'size-20': 'var(--font-size-20)',
        'size-24': 'var(--font-size-24)',
        'size-32': 'var(--font-size-32)',
      },
      zIndex: {
        'base': 'var(--z-base)',
        'sticky': 'var(--z-sticky)',
        'dropdown': 'var(--z-dropdown)',
        'popover': 'var(--z-popover)',
        'drawer': 'var(--z-drawer)',
        'modal': 'var(--z-modal)',
        'toast': 'var(--z-toast)',
        'tooltip': 'var(--z-tooltip)',
      },
      // WCAG 2.1 AA Compliance: Enhanced focus indicators
      ringWidth: {
        DEFAULT: '2px', // Changed from 1px for better visibility
      },
      ringOffsetWidth: {
        DEFAULT: '2px', // Add offset for clearer separation
      },
      fontFamily: {
        display: ['Geist', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
