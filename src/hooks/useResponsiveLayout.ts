import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * Detects current breakpoint based on window width.
 * - mobile:  < 768px
 * - tablet:  768–1023px
 * - desktop: ≥ 1024px
 */
export function useResponsiveLayout() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => getBreakpoint());

  useEffect(() => {
    const handler = () => setBreakpoint(getBreakpoint());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isCompact: breakpoint === 'mobile' || breakpoint === 'tablet',
  };
}

function getBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}
