import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function cleanupModalArtifacts() {
  // Remove all radix portal elements that might be lingering
  const portals = document.querySelectorAll('[data-radix-portal]')
  portals.forEach(portal => {
    if (portal && portal.parentNode) {
      portal.remove()
    }
  })
  
  // Remove any overlay/backdrop elements
  const overlays = document.querySelectorAll('[role="dialog"], [data-state="open"], [data-state="closed"]')
  overlays.forEach(overlay => {
    const parent = overlay.parentElement
    if (parent && parent.style.pointerEvents === 'none') {
      parent.style.pointerEvents = ''
    }
  })
  
  // Restore body styles
  document.body.style.pointerEvents = ''
  document.body.style.overflow = ''
  document.body.style.position = ''
  document.body.classList.remove('pointer-events-none')
  
  // Remove any aria-hidden from body
  document.body.removeAttribute('aria-hidden')
  
  // Force focus back to body
  document.body.focus()
  
  // Dispatch a click event to ensure interactivity
  setTimeout(() => {
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, 10)
}
