'use client'

/**
 * Growa brand UI primitives.
 *
 * Ported from the Growa SaaS (`components/brand/ui.jsx`) so that both
 * products share one vocabulary. The design system deliberately defines
 * no form, modal or notification ("the source shows no form, no modal and
 * no notification anywhere. Add them only against a real screen"): these
 * are DEDUCED from the rules it does state, and should be reviewed by the
 * brand agency like the SaaS ones.
 *
 * Rules applied throughout:
 *  · buttons, tags and switches are ALWAYS pills;
 *  · radius = 25% of the shortest side (a 44px field → 12px);
 *  · one-pixel borders, almost no shadows, no decorative gradients;
 *  · focus is a 2px sage ring, 2px away;
 *  · press compresses to 98.5%, never bounces;
 *  · sentence case everywhere — the micro-label is the only uppercase;
 *  · the only pictographic sign is the SQUARE, never a circle.
 */

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type RefObject,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

/* ------------------------------------------------------------------ *
 * Micro-label — the only uppercase the brand allows. Brackets are a deck
 * idiom for section labels: ( HUMAN TRUTH ), ( THE RESULT ).
 * ------------------------------------------------------------------ */
export function Eyebrow({
  children,
  className = '',
  brackets = false,
}: {
  children: ReactNode
  className?: string
  brackets?: boolean
}) {
  return (
    <span className={cn('growa-eyebrow text-content-soft', className)}>
      {brackets ? <>( {children} )</> : children}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Button — design-system `.g-btn` classes with the system's own heights
 * (32 / 44 / 56). `as` accepts Next's `<Link>` so navigation stays
 * client-side.
 * ------------------------------------------------------------------ */
const BUTTON_SIZES = {
  sm: { h: 32, px: 16, fs: 'var(--text-body-sm)' },
  md: { h: 44, px: 24, fs: 'var(--text-body)' },
  lg: { h: 56, px: 32, fs: 'var(--text-subheading)' },
} as const

export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'inverse'
  | 'glass'

type ButtonProps = {
  variant?: ButtonVariant
  size?: keyof typeof BUTTON_SIZES
  fullWidth?: boolean
  as?: ElementType
  href?: string
  children?: ReactNode
  className?: string
  style?: CSSProperties
} & Omit<ComponentProps<'button'>, 'style' | 'className' | 'children'> &
  Record<string, unknown>

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  as,
  href,
  children,
  className = '',
  style,
  ...rest
}: ButtonProps) {
  const s = BUTTON_SIZES[size] ?? BUTTON_SIZES.md
  const Tag: ElementType = as || (href ? 'a' : 'button')
  return (
    <Tag
      href={href}
      className={cn('g-btn', `g-btn--${variant}`, className)}
      style={{
        height: s.h,
        padding: `0 ${s.px}px`,
        fontSize: s.fs,
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
      {...rest}
    >
      {/* Its own inline-flex with the button's gap: a lone inline child
          would swallow `.g-btn`'s gap and glue icons to the text. */}
      <span className="inline-flex items-center gap-2">{children}</span>
    </Tag>
  )
}

/* ------------------------------------------------------------------ *
 * Text field. Sentence-case label (a field label is not a micro-label).
 * 44px high → 12px radius: the brand rule applied, not a guess.
 * `className` dresses the BLOCK, `inputClassName` the input.
 * ------------------------------------------------------------------ */
type FieldProps = {
  id?: string
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  prefix?: ReactNode
  suffix?: ReactNode
  className?: string
  inputClassName?: string
} & Omit<ComponentProps<'input'>, 'prefix' | 'className'>

const fieldBase = [
  'w-full bg-card text-content',
  'placeholder:text-content-soft',
  'border transition-colors outline-none',
  'focus:border-sage',
  'disabled:opacity-40 disabled:cursor-not-allowed',
]

const fieldStyle: CSSProperties = {
  borderRadius: 'var(--radius-lg)',
  fontSize: 'var(--text-body)',
  transitionDuration: 'var(--dur-fast)',
  transitionTimingFunction: 'var(--ease-brand)',
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-[14px] text-content-soft mb-2">
      {children}
    </label>
  )
}

function FieldHelp({ hint, error }: { hint?: ReactNode; error?: ReactNode }) {
  if (!hint && !error) return null
  return (
    <p className={cn('mt-2 text-[12px]', error ? 'text-critical' : 'text-content-soft')}>
      {error || hint}
    </p>
  )
}

export function Field({
  id,
  label,
  hint,
  error,
  prefix,
  suffix,
  className = '',
  inputClassName = '',
  ...rest
}: FieldProps) {
  return (
    <div className={className || undefined}>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <div className="relative">
        <input
          id={id}
          className={cn(
            ...fieldBase,
            'h-11',
            error ? 'border-critical' : 'border-line-strong',
            // One side at a time, never `px-4` with `ps-11`: both target the
            // same logical property and the stylesheet order would decide.
            prefix ? 'ps-11' : 'ps-4',
            suffix ? 'pe-11' : 'pe-4',
            inputClassName,
          )}
          style={fieldStyle}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        {/* `start`/`end`, not left/right: the Arabic layout is mirrored. */}
        {prefix && (
          <div className="absolute start-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-content-soft">
            {prefix}
          </div>
        )}
        {suffix && (
          <div className="absolute end-3 top-1/2 -translate-y-1/2 flex items-center">{suffix}</div>
        )}
      </div>
      <FieldHelp hint={hint} error={error} />
    </div>
  )
}

/* Password with a TEXT show/hide toggle: the brand has no icon set and
   says not to introduce one without need; two words in sentence case are
   the register of its buttons. */
export function PasswordField({
  tShow = 'Show',
  tHide = 'Hide',
  ...rest
}: Omit<FieldProps, 'type' | 'suffix'> & { tShow?: string; tHide?: string }) {
  const [visible, setVisible] = useState(false)
  const { tr } = useI18n()
  return (
    <Field
      type={visible ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="text-[12px] text-content-soft hover:text-content transition-colors px-1"
          aria-pressed={visible}
        >
          {visible ? tr(tHide) : tr(tShow)}
        </button>
      }
      {...rest}
    />
  )
}

export function Textarea({
  id,
  label,
  hint,
  error,
  className = '',
  rows = 3,
  ...rest
}: {
  id?: string
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  className?: string
} & Omit<ComponentProps<'textarea'>, 'className'>) {
  return (
    <div className={className || undefined}>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <textarea
        id={id}
        rows={rows}
        className={cn(
          ...fieldBase,
          'px-4 py-3 resize-y',
          error ? 'border-critical' : 'border-line-strong',
        )}
        style={{ ...fieldStyle, lineHeight: 1.45 }}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      <FieldHelp hint={hint} error={error} />
    </div>
  )
}

/* Native select with the brand frame and our own chevron: the system
   arrow is three different glyphs on three operating systems. */
export function Select({
  id,
  label,
  hint,
  error,
  className = '',
  children,
  ...rest
}: {
  id?: string
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode
} & Omit<ComponentProps<'select'>, 'className' | 'children'>) {
  return (
    <div className={className || undefined}>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <div className="relative">
        <select
          id={id}
          className={cn(
            ...fieldBase,
            'h-11 ps-4 pe-10 appearance-none cursor-pointer',
            error ? 'border-critical' : 'border-line-strong',
          )}
          style={fieldStyle}
          aria-invalid={error ? true : undefined}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          size={16}
          strokeWidth={1.5}
          className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-content-soft"
        />
      </div>
      <FieldHelp hint={hint} error={error} />
    </div>
  )
}

/* Checkbox: SQUARE box, and when checked a filled square inside instead of
   a tick — the data-point square is the only sign the brand owns. */
export function Checkbox({
  id,
  label,
  checked,
  onChange,
  disabled,
  className = '',
}: {
  id?: string
  label?: ReactNode
  checked?: boolean
  onChange?: ComponentProps<'input'>['onChange']
  disabled?: boolean
  className?: string
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex items-center gap-3 cursor-pointer select-none',
        disabled && 'opacity-40 cursor-not-allowed',
        className,
      )}
    >
      <span className="relative inline-flex items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer appearance-none w-[18px] h-[18px] border border-line-strong bg-card
                     checked:border-ink focus-visible:outline-2 focus-visible:outline-sage
                     focus-visible:outline-offset-2 transition-colors cursor-pointer
                     disabled:cursor-not-allowed"
          style={{ borderRadius: 'var(--radius-xs)' }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute w-[8px] h-[8px] bg-ink opacity-0 peer-checked:opacity-100 transition-opacity"
          style={{ borderRadius: 1 }}
        />
      </span>
      {label && <span className="text-[14px] text-content">{label}</span>}
    </label>
  )
}

/* Password strength: three steps in the system's three states — sage is
   "good", never a traffic-light green. */
export function passwordLevel(password: string): 1 | 2 | 3 {
  let points = 0
  if (password.length >= 8) points++
  if (password.length >= 12) points++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++
  if (/\d/.test(password)) points++
  if (/[^a-zA-Z\d]/.test(password)) points++
  return points <= 1 ? 1 : points <= 3 ? 2 : 3
}

export function PasswordStrength({
  password,
  labels = ['Weak', 'Medium', 'Strong'],
  tLabel = 'Password strength',
}: {
  password: string
  labels?: [string, string, string]
  tLabel?: string
}) {
  const { tr } = useI18n()
  if (!password) return null
  const level = passwordLevel(password)
  const tone = level === 1 ? 'critical' : level === 2 ? 'progress' : 'good'
  return (
    <div className="mt-3">
      <div className="flex gap-1">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className="h-[3px] flex-1"
            style={{
              borderRadius: 1,
              background: n <= level ? `var(--status-${tone})` : 'var(--growa-stone-200)',
              transition: 'background-color var(--dur-fast) var(--ease-brand)',
            }}
          />
        ))}
      </div>
      <p className="mt-2 text-[12px] text-content-soft">
        {tr(tLabel)}: {tr(labels[level - 1] ?? '')}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * The lattice of square points — the brand's only graphic element. An
 * absolutely positioned layer over an ink panel or a photograph.
 * ------------------------------------------------------------------ */
export function Lattice({
  className = '',
  step = 36,
  size = 3,
  color,
  style,
}: {
  className?: string
  step?: number
  size?: number
  color?: string
  style?: CSSProperties
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('growa-square-grid absolute inset-0', className)}
      style={
        {
          '--dot-step': `${step}px`,
          '--dot-size': `${size}px`,
          '--dot-color': color,
          ...style,
        } as CSSProperties
      }
    />
  )
}

/* Form message: no italics, no exclamation marks — short statements. */
export function FormMessage({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success'
  children?: ReactNode
}) {
  if (!children) return null
  const critical = tone === 'error'
  return (
    <p
      role={critical ? 'alert' : 'status'}
      className={cn('text-[14px]', critical ? 'text-critical' : 'text-content-accent')}
    >
      {children}
    </p>
  )
}

/* ------------------------------------------------------------------ *
 * Status square — radius 1px: a square, not a circle. It is the bullet,
 * the indicator and the map node.
 * ------------------------------------------------------------------ */
export const TONES = {
  good: 'var(--status-good)',
  critical: 'var(--status-critical)',
  live: 'var(--status-live)',
  progress: 'var(--status-progress)',
  neutral: 'var(--status-neutral)',
  warning: 'var(--warning)',
  cream: 'var(--growa-cream)',
  ink: 'var(--growa-ink)',
} as const
export type Tone = keyof typeof TONES

export function StatusDot({
  tone = 'good',
  size = 7,
  label,
  pulse = false,
  className = '',
  style,
}: {
  tone?: Tone | (string & {})
  size?: number
  label?: ReactNode
  pulse?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} style={style}>
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          flex: 'none',
          background: TONES[tone as Tone] ?? tone,
          borderRadius: 1,
          animation: pulse ? 'g-pulse 1.8s var(--ease-inout) infinite' : undefined,
        }}
      />
      {label ? <span style={{ fontSize: 'var(--text-caption)', color: 'inherit' }}>{label}</span> : null}
    </span>
  )
}

/* Tag — Brand Book p.79. Always a pill. */
export type TagVariant = 'outline' | 'outline-ink' | 'outline-inverse' | 'cream' | 'ink' | 'muted'

export function Tag({
  variant = 'outline',
  size = 'md',
  children,
  className = '',
  style,
  ...rest
}: {
  variant?: TagVariant
  size?: 'sm' | 'md'
  children?: ReactNode
  className?: string
  style?: CSSProperties
} & Omit<ComponentProps<'span'>, 'className' | 'style' | 'children'>) {
  return (
    <span
      className={cn('g-tag', `g-tag--${variant}`, className)}
      style={{
        height: size === 'sm' ? 22 : 28,
        padding: `0 ${size === 'sm' ? 10 : 12}px`,
        fontSize: size === 'sm' ? 'var(--text-micro)' : 'var(--text-caption)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  )
}

/* Metric — big number LIGHT, unit small beside it (Brand Book p.80). */
export function Metric({
  label,
  value,
  unit,
  hint,
  size = 'title',
  className = '',
}: {
  label?: ReactNode
  value: ReactNode
  unit?: ReactNode
  hint?: ReactNode
  size?: 'heading' | 'title' | 'display-3'
  className?: string
}) {
  return (
    <div className={className || undefined}>
      {label && <p className="text-[12px] text-content-soft">{label}</p>}
      <p className="growa-figure text-content mt-1" style={{ fontSize: `var(--text-${size})` }}>
        {value}
        {unit && (
          <span className="ms-1 text-[12px] text-content-soft" style={{ fontWeight: 400, letterSpacing: 0 }}>
            {unit}
          </span>
        )}
      </p>
      {hint && <p className="text-[11px] text-content-soft mt-1">{hint}</p>}
    </div>
  )
}

/* Two-up switch — Brand Book p.79: cream pill, active item filled ink.
   Use it instead of underlined tabs: the brand has no underlined tab. */
export type SegmentOption<V extends string | number> = { value: V; label: ReactNode; title?: string }

export function SegmentedToggle<V extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  inverse = false,
  className = '',
  disabled = false,
  ariaLabel,
}: {
  options: SegmentOption<V>[]
  value: V
  onChange: (v: V) => void
  size?: 'sm' | 'md'
  inverse?: boolean
  className?: string
  disabled?: boolean
  ariaLabel?: string
}) {
  const h = size === 'sm' ? 30 : 36
  return (
    <div
      className={cn('g-seg', inverse && 'g-seg--inverse', disabled && 'opacity-60', className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          disabled={disabled}
          aria-selected={value === o.value}
          aria-label={o.title}
          title={o.title}
          data-active={value === o.value ? 'true' : 'false'}
          onClick={() => onChange(o.value)}
          className="g-seg__item"
          style={{
            height: h,
            padding: `0 ${size === 'sm' ? 14 : 18}px`,
            fontSize: size === 'sm' ? 'var(--text-caption)' : 'var(--text-body-sm)',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * useDialog — a window's behaviour, separate from its look.
 *  · Esc closes the TOPMOST window only;
 *  · Tab / Shift+Tab cycle inside it;
 *  · focus moves in (to `initial` if given) and is restored on close;
 *  · the page behind stops scrolling.
 * ------------------------------------------------------------------ */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const dialogStack: object[] = []
let scrollLocks = 0

export function useDialog(
  open: boolean,
  onClose: (() => void) | undefined,
  ref: RefObject<HTMLElement | null>,
  { initial }: { initial?: RefObject<HTMLElement | null> } = {},
) {
  // `onClose` is usually an inline function: as an effect dependency the
  // dialog would "reopen" on every render and steal focus while typing.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const me = {}
    dialogStack.push(me)
    const before = document.activeElement as HTMLElement | null
    const root = document.documentElement

    if (scrollLocks++ === 0) {
      root.dataset.overflowBefore = root.style.overflow || ''
      root.style.overflow = 'hidden'
    }

    const onKey = (e: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== me) return
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current?.()
        return
      }
      if (e.key !== 'Tab' || !ref.current) return
      const els = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (x) => x.offsetParent !== null || x === document.activeElement,
      )
      if (!els.length) {
        e.preventDefault()
        ref.current.focus()
        return
      }
      const first = els[0]
      const last = els[els.length - 1]
      const inside = ref.current.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)

    const raf = requestAnimationFrame(() => {
      const box = ref.current
      if (!box || box.contains(document.activeElement)) return
      const target = initial?.current || box.querySelector<HTMLElement>(FOCUSABLE) || box
      target.focus?.({ preventScroll: true })
    })

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      const i = dialogStack.indexOf(me)
      if (i >= 0) dialogStack.splice(i, 1)
      if (--scrollLocks === 0) {
        root.style.overflow = root.dataset.overflowBefore || ''
        delete root.dataset.overflowBefore
      }
      if (before && document.contains(before)) before.focus?.({ preventScroll: true })
    }
    // `ref` and `initial` are stable; `onClose` goes through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}

/* Modal: white card with the brand's large radius, the one shadow allowed
   for floating things, and an INK veil instead of black (pure black is not
   a brand colour). Title fixed at top, footer at bottom, body scrolls. */
const MODAL_W = { sm: 420, md: 560, lg: 760 } as const

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  initial,
  zIndex = 50,
}: {
  open: boolean
  onClose?: () => void
  title?: string
  children?: ReactNode
  footer?: ReactNode
  size?: keyof typeof MODAL_W
  initial?: RefObject<HTMLElement | null>
  zIndex?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  useDialog(open, onClose, box, { initial })
  if (!open) return null
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(17,30,19,.45)', zIndex }}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="growa bg-card w-full flex flex-col max-h-[85vh] p-7 outline-none"
        style={{
          maxWidth: MODAL_W[size] ?? MODAL_W.md,
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-panel-lg)',
        }}
      >
        {title && (
          <h2 className="text-content shrink-0 text-heading" style={{ fontWeight: 500, letterSpacing: 'var(--ls-heading)' }}>
            {title}
          </h2>
        )}
        {/* `-mx-1 px-1`: the sage focus ring sits 2px OUTSIDE the field and
            would otherwise be clipped by the scrolling container. */}
        <div className="mt-4 -mx-1 px-1 flex-1 min-h-0 overflow-y-auto text-[14px] leading-[1.45] text-content-soft">
          {children}
        </div>
        {footer && <div className="mt-7 shrink-0 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  )
}

/* Switch: a pill. ON is INK, not sage — sage says "the field is fine",
   a switch only says "something is active". `pending` is the third state
   of a command sent but not yet confirmed. */
const SWITCH_SIZES = {
  sm: { w: 36, h: 20, k: 16 },
  md: { w: 44, h: 24, k: 18 },
} as const

export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  pending = false,
  size = 'md',
  className = '',
  id,
}: {
  checked: boolean
  onChange?: (next: boolean) => void
  disabled?: boolean
  label?: string
  pending?: boolean
  size?: keyof typeof SWITCH_SIZES
  className?: string
  id?: string
}) {
  const m = SWITCH_SIZES[size] ?? SWITCH_SIZES.md
  const gap = (m.h - m.k) / 2
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      aria-busy={pending || undefined}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange?.(!checked)
      }}
      className={cn(
        'relative inline-flex shrink-0 items-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        className,
      )}
      style={{
        width: m.w,
        height: m.h,
        borderRadius: 'var(--radius-pill)',
        transitionDuration: 'var(--dur-fast)',
        background: pending ? 'var(--status-progress)' : checked ? 'var(--growa-ink)' : 'var(--growa-stone-300)',
      }}
    >
      <span
        aria-hidden="true"
        className="inline-block bg-white transition-transform"
        style={{
          width: m.k,
          height: m.k,
          borderRadius: 'var(--radius-pill)',
          transitionDuration: 'var(--dur-fast)',
          marginInlineStart: gap,
          // Mirrored in Arabic: ON slides toward the END of the line.
          transform: `translateX(calc(${checked ? m.w - m.k - 2 * gap : 0}px * var(--dir-segno, 1)))`,
        }}
      />
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * CHART SERIES — ten categorical colours, the SaaS palette (DERIVED, to
 * be validated). Warm, desaturated, alternating light and dark so ten
 * lines stay separable. The system red is deliberately NOT in the list:
 * a series would read as an alarm.
 * ------------------------------------------------------------------ */
export const SERIES_COLORS = [
  '#6C8952', // sage — brand
  '#B4644A', // terracotta
  '#C9A227', // ochre
  '#2F5D50', // dark teal
  '#D19C8A', // clay pink (light)
  '#55611F', // dark olive
  '#5C7A88', // warm slate
  '#4A3B32', // dark brown
  '#E0C9A6', // light sand
  '#8C9388', // warm grey — stone-500
] as const

export const seriesColor = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length]

/* Literal brand values for canvas / Leaflet / SVG attributes, where CSS
   variables cannot be resolved (or `getComputedStyle` returns `var(...)`). */
export const BRAND_HEX = {
  white: '#FFFFFF',
  cream: '#EEF4C9',
  sage: '#6C8952',
  ink: '#111E13',
  sage700: '#475B37',
  ink800: '#18291B',
  stone200: '#E1E4DC',
  stone300: '#CBD0C5',
  stone500: '#8C9388',
  stone600: '#5C635A',
  critical: '#A8392B',
  live: '#C0392B',
  warning: '#C9A227',
} as const

/* Fill bar: geometry here, thresholds outside. 2px radius on 8px (25%),
   not a pill — the pill is the shape of buttons and tags, not charts. */
export function FillBar({
  pct,
  tone = 'good',
  className = '',
  label,
}: {
  pct: number | null | undefined
  tone?: Tone | (string & {})
  className?: string
  label?: string
}) {
  if (pct == null) return null
  const v = Math.min(100, Math.max(0, pct))
  return (
    <div
      className={cn('h-2 w-full overflow-hidden', className)}
      style={{ background: 'var(--growa-stone-200)', borderRadius: 2 }}
      role={label ? 'meter' : 'presentation'}
      aria-label={label}
      aria-valuenow={label ? v : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
    >
      <div
        className="h-full transition-all"
        style={{
          width: `${v}%`,
          background: TONES[tone as Tone] ?? tone,
          borderRadius: 2,
          transitionDuration: 'var(--dur-base)',
          transitionTimingFunction: 'var(--ease-brand)',
        }}
      />
    </div>
  )
}

/* Empty-state mark: 3×3 lattice of unlit squares, instead of large grey
   illustrative icons the brand does not have. */
export function EmptyMark({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('mx-auto mb-5 grid grid-cols-3 gap-1.5 w-fit', className)}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="block w-1.5 h-1.5 bg-stone-300" style={{ borderRadius: 1 }} />
      ))}
    </div>
  )
}

/* Loading: the lattice that lights up, diagonal by diagonal. */
export function LatticeLoader({ className = '', label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <div role="status" aria-label={label} className={cn('grid grid-cols-3 gap-1.5 w-fit', className)}>
      {Array.from({ length: 9 }).map((_, i) => {
        const diagonal = Math.floor(i / 3) + (i % 3)
        return (
          <span
            key={i}
            aria-hidden="true"
            className="growa-loader-dot block w-1.5 h-1.5 bg-current"
            style={{ borderRadius: 1, animationDelay: `${diagonal * 0.3}s` }}
          />
        )
      })}
    </div>
  )
}

/* Divider: inside panels the brand uses the dotted rule, never a solid
   line. */
export function DottedDivider({ label, className = '' }: { label?: ReactNode; className?: string }) {
  if (!label) return <hr className={cn('growa-dotted-rule', className)} />
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <hr className="growa-dotted-rule flex-1" />
      <span className="text-[12px] text-content-soft">{label}</span>
      <hr className="growa-dotted-rule flex-1" />
    </div>
  )
}

/* Section title with the filled square before it ("▪ Container 2",
   Brand Book p.80). */
export function SectionTitle({
  children,
  as: Tag = 'h2',
  className = '',
  action,
}: {
  children: ReactNode
  as?: 'h1' | 'h2' | 'h3'
  className?: string
  action?: ReactNode
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <Tag className="flex items-center gap-2 text-content text-[15px]" style={{ fontWeight: 500 }}>
        <span aria-hidden="true" className="block w-2 h-2 bg-content shrink-0" style={{ borderRadius: 1 }} />
        {children}
      </Tag>
      {action}
    </div>
  )
}
