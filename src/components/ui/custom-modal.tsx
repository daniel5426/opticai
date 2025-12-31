import React, { useEffect, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from './button'

interface CustomModalProps {
  isOpen: boolean
  onClose: () => void
  width?: string
  title: string
  subtitle?: string
  description?: string
  children?: React.ReactNode
  className?: string
  onConfirm?: () => void
  confirmText?: string
  cancelText?: string
  showCloseButton?: boolean
  isLoading?: boolean
  headerContent?: React.ReactNode
}

export function CustomModal({ isOpen, onClose, title, subtitle, description, children, className = '', width = 'max-w-lg', onConfirm, confirmText = 'אישור', cancelText = 'ביטול', showCloseButton = true, isLoading = false, headerContent }: CustomModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll
      document.body.style.overflow = 'hidden'

      // Focus the modal
      setTimeout(() => {
        modalRef.current?.focus()
      }, 100)
    } else {
      // Restore body scroll
      document.body.style.overflow = ''

      // Force focus back to body and ensure interactivity
      document.body.focus()
      document.body.style.pointerEvents = ''

      // Dispatch a click to ensure the page is responsive
      setTimeout(() => {
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      }, 50)
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = ''
      document.body.style.pointerEvents = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
      style={{ pointerEvents: 'auto' }}
      dir="rtl"
    >
      <div
        ref={modalRef}
        className={`bg-card rounded-lg shadow-lg w-1/2 ${width} max-h-[90vh] overflow-hidden flex flex-col ${className}`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between py-2 px-4 flex-shrink-0 border-b" dir="rtl">
          {/* Right side: Subtitle */}
          <div className="flex-1 text-right">
            {subtitle && (
              <p className="text-sm text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>

          {/* Center: Title */}
          <div className="flex-1 text-center">
            <h2 className="text-base font-medium">
              {title}
            </h2>
          </div>

          {/* Left side: Header content + close button */}
          <div className="flex-1 flex items-center justify-end gap-2">
            {headerContent}
            {showCloseButton &&
              (<Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>)}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 p-3 overflow-y-auto flex-1" dir="rtl">
          <div className="space-y-4">

            {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}

            {children}
          </div>
        </div>

        {onConfirm && (
          <div className="flex justify-center p-4 " dir="rtl">
            <Button variant="outline" onClick={onClose} className="ml-2" disabled={isLoading}>
              {cancelText}
            </Button>
            <Button onClick={onConfirm} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                confirmText
              )}
            </Button>
          </div>
        )}

      </div>
    </div>
  )
} 