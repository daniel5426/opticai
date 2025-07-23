import React from 'react'

interface ClientSpaceLayoutProps {
  children: React.ReactNode
}

export function ClientSpaceLayout({ children }: ClientSpaceLayoutProps) {
  return (
    <div className="flex flex-col flex-1 overflow-auto min-w-0" style={{scrollbarWidth: 'none'}}>
      {children}
    </div>
  )
} 