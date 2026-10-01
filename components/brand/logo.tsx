/**
 * Growa wordmark.
 *
 * Paths are copied verbatim from the official rebrand export
 * (`GROWA BRAND ASSETS/LOGO EXPORTS/LOGO SVG/`). The four exported files
 * (black, dark green, white, yellow) share identical paths and differ only
 * in fill, so there is a single component drawn in `currentColor`: the
 * caller picks the colour with a class.
 *
 *     <Logo className="h-7 text-ink" />     ink mark on light surfaces
 *     <Logo className="h-7 text-cream" />   cream mark on ink / photography
 *
 * Allowed colours are only the exported variants: ink, cream, white, black.
 *
 * The trailing square is not a full stop: it is the brand's data point,
 * the same shape as the lattice. It belongs to the mark and must not be
 * detached, moved or re-rounded.
 *
 * CLEAR SPACE — Brand Book p.21: "The square element defines the minimum
 * clear space around the logo. This area must remain free from text,
 * graphics, and photographic elements." Measured on the path: the square is
 * 42.23 high on a 105.92 mark, so clear space is ~0.4 × mark height on every
 * side. Use `clearSpacePx()` instead of eyeballing it.
 *
 * FORBIDDEN USES — Brand Book p.22: no skewing, rotating, enlarging a part,
 * distorting, off-palette colours, ENCLOSING THE MARK IN A SHAPE, altering
 * spacing, textures as colour, poor reproductions. The sixth is the one code
 * breaks by accident: no tile, pill or circle behind the mark in a top bar.
 */

import type { SVGProps } from 'react'

const MARK_H = 105.92
const SQUARE = 42.23

/** Minimum clear space, in px, around a mark rendered `heightPx` tall. */
export function clearSpacePx(heightPx: number) {
  return Math.round(heightPx * (SQUARE / MARK_H))
}

type LogoProps = SVGProps<SVGSVGElement> & { title?: string }

export function Logo({ className = '', title = 'Growa', ...rest }: LogoProps) {
  return (
    <svg
      viewBox="0 0 549.18 105.92"
      fill="currentColor"
      role="img"
      aria-label={title}
      className={className}
      {...rest}
    >
      <path d="M0,52.97C0,22.74,22.45,0,48.4,0c22.3,0,39.77,15.84,43.86,33.75h-13.79c-3.97-10.86-14.08-20.98-30.08-20.98-18.48,0-34.92,16.43-34.92,40.2s16.44,40.2,34.92,40.2c15.44,0,26.69-9.77,30.36-21.96.95-3.15-1.46-6.36-4.75-6.36h-22.96v-11.87h37.96c2.7,0,4.89,2.19,4.89,4.89v46.45h-8.8l-2.64-15.7c-6.16,8.66-18.19,17.31-34.04,17.31C22.45,105.92,0,83.18,0,52.97Z" />
      <path d="M160.56,66.32c-1.42-2.43-.54-5.65,2.02-6.8,11.02-4.95,18.09-14.88,18.09-26.96,0-17.45-13.93-30.95-32.86-30.95h-32.66c-2.7,0-4.89,2.19-4.89,4.89v97.8h13.5v-36.47c0-2.7,2.19-4.89,4.89-4.89h12.34c1.77,0,3.4.96,4.27,2.5l20.37,36.36c.87,1.54,2.5,2.5,4.27,2.5h12.83l-22.17-37.98ZM123.76,45.58v-26.46c0-2.7,2.19-4.89,4.89-4.89h19.02c11.44,0,19.51,7.78,19.51,18.49,0,10.12-8.06,17.75-19.51,17.75h-19.02c-2.7,0-4.89-2.19-4.89-4.89Z" />
      <path d="M235.3,0c-25.96,0-48.4,22.74-48.4,52.97s22.45,52.95,48.4,52.95,48.42-22.74,48.42-52.95S261.27,0,235.3,0ZM235.3,93.16c-18.48,0-34.92-16.44-34.92-40.2s16.44-40.2,34.92-40.2,34.92,16.43,34.92,40.2-16.28,40.2-34.92,40.2Z" />
      <path d="M296.22,1.61l17.83,60.92c1.38,4.71,8.06,4.68,9.4-.03L340.81,1.61h9.83l17.63,61.01c1.36,4.7,8.02,4.72,9.4.02L395.53,1.61h13.5l-31.25,102.7h-10.27l-17.15-59.02c-1.37-4.71-8.04-4.7-9.4,0l-17.02,59.01h-10.42L282.27,1.61h13.94" />
      <path d="M450.76,1.61h-12.91l-38.73,102.7h13.79l7.78-21.42c.7-1.93,2.54-3.22,4.6-3.22h37.45c2.06,0,3.9,1.29,4.6,3.22l7.78,21.42h14.38L450.76,1.61ZM428.97,60.61l10.45-28.34c1.57-4.27,7.61-4.27,9.18,0l10.44,28.34c1.18,3.19-1.19,6.58-4.59,6.58h-20.88c-3.4,0-5.77-3.39-4.59-6.58Z" />
      <rect x="506.94" y="1.61" width="42.23" height="42.23" rx="8.7" ry="8.7" />
    </svg>
  )
}

/**
 * The square of the mark alone — favicon, avatar, tight spaces where the
 * word does not fit. Same radius as the mark, not an arbitrary one.
 */
export function LogoMark({ className = '', ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 42.23 42.23" fill="currentColor" aria-hidden="true" className={className} {...rest}>
      <rect width="42.23" height="42.23" rx="8.7" ry="8.7" />
    </svg>
  )
}
