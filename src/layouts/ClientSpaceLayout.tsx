import React from 'react'

interface ClientSpaceLayoutProps {
  children: React.ReactNode
}

export function ClientSpaceLayout({ children }: ClientSpaceLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{scrollbarWidth: 'none'}}>
      {children}
    </div>
  )
}
