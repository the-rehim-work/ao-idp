import { useEffect } from 'react'

interface ConfirmModalProps {
  title: string
  message: string
  itemName?: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
  isPending?: boolean
}

export function ConfirmModal({
  title, message, itemName, confirmLabel = 'confirm',
  onConfirm, onClose, isPending = false,
}: ConfirmModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md border" style={{ background: '#000', borderColor: 'rgba(255,51,51,0.4)' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,51,51,0.2)', background: 'rgba(255,51,51,0.04)' }}>
          <div className="text-xs tracking-widest uppercase font-bold" style={{ color: '#ff3333' }}>
            [warn] {title.toLowerCase()}
          </div>
          <button onClick={onClose} style={{ color: '#ff3333', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', opacity: 0.6 }}>×</button>
        </div>

        <div className="p-6">
          <p className="text-sm mb-4 leading-relaxed" style={{ color: '#009bb5' }}>{message}</p>

          {itemName && (
            <div className="mb-4 px-3 py-2 text-xs break-all" style={{ background: 'rgba(255,51,51,0.06)', border: '1px solid rgba(255,51,51,0.2)', color: '#ff6666', fontFamily: 'inherit' }}>
              <span style={{ color: 'rgba(255,51,51,0.4)' }}>target: </span>{itemName}
            </div>
          )}

          <p className="text-xs mb-6" style={{ color: 'rgba(255,51,51,0.4)', fontFamily: 'inherit' }}>
            [!] this action cannot be undone.
          </p>

          <div className="flex gap-3 justify-end">
            <button onClick={onClose}
              className="px-4 py-2 text-xs tracking-wide"
              style={{ color: '#009bb5', border: '1px solid rgba(0,255,255,0.2)', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              cancel
            </button>
            <button onClick={onConfirm} disabled={isPending}
              className="px-5 py-2 text-xs font-bold tracking-widest uppercase disabled:opacity-40"
              style={{ color: '#ff3333', border: '1px solid rgba(255,51,51,0.4)', background: 'rgba(255,51,51,0.08)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {isPending ? 'processing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
