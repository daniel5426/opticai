import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
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
}

export function CustomModal({ isOpen, onClose, title, subtitle, description, children, className = '', width = 'max-w-lg', onConfirm, confirmText = 'אישור', cancelText = 'ביטול', showCloseButton = true }: CustomModalProps) {
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
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg ${width} max-h-[90vh] overflow-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-gray-200 dark:border-gray-700">
          <div className=" flex-1" dir="rtl">
            <h2 className="text-lg font-semibold">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {showCloseButton && 
          (<Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 ml-2"
          >
            <X className="h-4 w-4" />
          </Button>)}
        </div>
        
        {/* Content */}
        <div className="px-6 p-3" dir="rtl">
        <div className="space-y-4">

          {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}

          {children}
          </div>
        </div>

        {onConfirm && (
          <div className="flex justify-center p-4 border-t border-gray-200 dark:border-gray-700" dir="rtl">
            <Button variant="outline" onClick={onClose} className="ml-2">
              {cancelText}
            </Button>
            <Button onClick={onConfirm}>
              {confirmText}
            </Button>
          </div>
        )}

      </div>
    </div>
  )
} 