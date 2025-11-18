import React from 'react'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

type NotesCardProps = {
  title: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  height?: string
}

export function NotesCard({ title, value, onChange, disabled = false, placeholder = '', height = 'full' }: NotesCardProps) {
  return (
    <Card className={`w-full px-4 pt-3 pb-4 gap-2`} dir="rtl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-muted rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10,9 9,9 8,9"></polyline>
          </svg>
        </div>
        <h3 className="text-base font-medium text-muted-foreground">{title}</h3>
      </div>
      <Textarea
        disabled={disabled}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`text-sm w-full p-3 border rounded-lg disabled:opacity-100 disabled:cursor-default min-h[90px] ${disabled ? 'bg-accent/50' : ''} h-[${height}]`}
        rows={4}
        placeholder={disabled ? '' : placeholder}
      />
    </Card>
  )
}


