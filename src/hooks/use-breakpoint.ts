import { useState, useEffect, useCallback } from 'react';

/**
 * useBreakpoint — Responsive breakpoint detection hook.
 * 
 * Based on: Design Token Rules v1 → Section 13
 * Breakpoints:
 *   xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280, 2xl: 1440
 */

const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1440,
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

interface UseBreakpointReturn {
  /** Current breakpoint */
  breakpoint: Breakpoint;
  /** Width in pixels */
  width: number;
  /** True if viewport is at or above the given breakpoint */
  isAbove: (bp: Breakpoint) => boolean;
  /** True if viewport is below the given breakpoint */
  isBelow: (bp: Breakpoint) => boolean;
  /** Convenience booleans */
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWideDesktop: boolean;
}

function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

export function useBreakpoint(): UseBreakpointReturn {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const breakpoint = getBreakpoint(width);

  const isAbove = useCallback(
    (bp: Breakpoint) => width >= BREAKPOINTS[bp],
    [width]
  );

  const isBelow = useCallback(
    (bp: Breakpoint) => width < BREAKPOINTS[bp],
    [width]
  );

  return {
    breakpoint,
    width,
    isAbove,
    isBelow,
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
    isWideDesktop: width >= BREAKPOINTS.xl,
  };
}

export default useBreakpoint;
