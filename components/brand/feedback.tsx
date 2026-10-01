'use client'

/**
 * Toasts and confirmations — one implementation for the whole app.
 *
 * Replaces the browser's `alert()` and `confirm()`: grey system windows
 * that block the page, carry nothing of the brand, label their buttons in
 * the BROWSER's language rather than the user's, and are not announced
 * consistently by screen readers.
 *
 *   const showToast = useToast()
 *   showToast(message, 'success' | 'error' | 'info')
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title, message, confirmLabel, danger }))) return
 *
 * Look (same as the SaaS): an ink pill for success/info, the system red
 * for errors — sage is the agronomic "good", not a UI colour. Top, at the
 * END of the line (right in English, left in Arabic). At most three stack.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { Button, Modal, StatusDot } from './ui'

type ToastTone = 'success' | 'error' | 'info'
type ToastItem = { id: number; message: string; tone: ToastTone }

export type ConfirmOptions =
  | string
  | {
      title?: string
      message?: string
      confirmLabel?: string
      cancelLabel?: string
      /** Defaults to true: nearly every confirmation guards a deletion. */
      danger?: boolean
    }

type Pending = Exclude<ConfirmOptions, string> & { resolve: (ok: boolean) => void }

type FeedbackValue = {
  showToast: (message: unknown, tone?: ToastTone) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackValue | null>(null)

const DURATION: Record<ToastTone, number> = { success: 4000, info: 4000, error: 6500 }
const MAX_TOASTS = 3

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  // The dictionary returns the key itself when a string is missing.
  const labelFor = useCallback((key: string, fallback: string) => {
    const v = t(key)
    return v === key ? fallback : v
  }, [t])

  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [pending, setPending] = useState<Pending | null>(null)
  const nextId = useRef(1)
  const cancelButton = useRef<HTMLButtonElement>(null)

  const dismiss = useCallback((id: number) => setToasts((a) => a.filter((x) => x.id !== id)), [])

  const showToast = useCallback(
    (message: unknown, tone: ToastTone = 'success') => {
      if (!message) return
      const id = nextId.current++
      setToasts((a) => [...a.slice(-(MAX_TOASTS - 1)), { id, message: String(message), tone }])
      setTimeout(() => dismiss(id), DURATION[tone])
    },
    [dismiss],
  )

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        const o = typeof options === 'string' ? { message: options } : options || {}
        setPending({ danger: true, ...o, resolve })
      }),
    [],
  )

  const answer = useCallback((ok: boolean) => {
    setPending((p) => {
      p?.resolve(ok)
      return null
    })
  }, [])

  const value = useMemo(() => ({ showToast, confirm }), [showToast, confirm])

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {/* Two live regions, always mounted (a region mounted together with
          its text is often not read): errors are `alert` (interrupt),
          the rest `status` (polite). */}
      <div
        className="growa fixed top-4 end-4 flex flex-col items-end gap-2 pointer-events-none"
        style={{ zIndex: 80, maxWidth: 'min(28rem, calc(100vw - 2rem))' }}
      >
        <div role="status" aria-live="polite" className="flex flex-col items-end gap-2">
          {toasts
            .filter((a) => a.tone !== 'error')
            .map((a) => (
              <Toast key={a.id} item={a} onDismiss={() => dismiss(a.id)} closeLabel={labelFor('common.close', 'Close')} />
            ))}
        </div>
        <div role="alert" aria-live="assertive" className="flex flex-col items-end gap-2">
          {toasts
            .filter((a) => a.tone === 'error')
            .map((a) => (
              <Toast key={a.id} item={a} onDismiss={() => dismiss(a.id)} closeLabel={labelFor('common.close', 'Close')} />
            ))}
        </div>
      </div>

      {/* Focus starts on "Cancel": in front of a deletion, a habitual
          Enter must not delete anything. */}
      <Modal
        open={!!pending}
        onClose={() => answer(false)}
        title={pending?.title || labelFor('common.confirm_title', 'Are you sure?')}
        size="sm"
        zIndex={90}
        initial={cancelButton}
        footer={
          <>
            <Button ref={cancelButton} variant="secondary" size="sm" onClick={() => answer(false)}>
              {pending?.cancelLabel || labelFor('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              style={pending?.danger ? { background: 'var(--status-critical)' } : undefined}
              onClick={() => answer(true)}
            >
              {pending?.confirmLabel ||
                (pending?.danger ? labelFor('common.delete', 'Delete') : labelFor('common.confirm', 'Confirm'))}
            </Button>
          </>
        }
      >
        {pending?.message && <p className="text-[14px] text-content-soft">{pending.message}</p>}
      </Modal>
    </FeedbackContext.Provider>
  )
}

function Toast({ item, onDismiss, closeLabel }: { item: ToastItem; onDismiss: () => void; closeLabel: string }) {
  const error = item.tone === 'error'
  return (
    <div
      className="pointer-events-auto flex items-start gap-3 ps-5 pe-3 py-3 text-[14px] text-white"
      style={{
        borderRadius: 'var(--radius-pill)',
        background: error ? 'var(--status-critical)' : 'var(--growa-ink)',
        boxShadow: 'var(--shadow-panel)',
        animation: 'growa-avviso-entra var(--dur-base) var(--ease-out)',
      }}
    >
      {error ? (
        <AlertCircle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden="true" />
      ) : (
        <StatusDot tone="cream" size={7} className="mt-1.5 shrink-0" />
      )}
      <span className="flex-1 min-w-0 break-words">{item.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={closeLabel}
        className="shrink-0 -my-0.5 w-6 h-6 inline-flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity rounded-pill"
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}

/* Outside the provider (tests, components mounted before it) the hooks
   fall back to the old behaviour instead of breaking. */
const fallbackToast = (m: unknown) => {
  if (typeof window !== 'undefined') console.warn('[toast]', m)
}
const fallbackConfirm = (o: ConfirmOptions) =>
  Promise.resolve(
    typeof window !== 'undefined' &&
      window.confirm(typeof o === 'string' ? o : o?.message || o?.title || ''),
  )

export const useToast = () => useContext(FeedbackContext)?.showToast ?? fallbackToast
export const useConfirm = () => useContext(FeedbackContext)?.confirm ?? fallbackConfirm
