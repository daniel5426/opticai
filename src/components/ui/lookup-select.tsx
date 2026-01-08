import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from './input'
import { Button } from './button'
import { Card } from './card'
import { IconChevronDown, IconPlus, IconCheck } from '@tabler/icons-react'
import { toast } from 'sonner'
import { useLookupData } from '@/hooks/useLookupData'
import { inputSyncManager } from '@/components/exam/shared/OptimizedInputs'
import { flushSync } from 'react-dom'

interface LookupItem {
  id?: number
  name: string
  created_at?: string
}

interface LookupSelectProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  lookupType: string
  className?: string
  disabled?: boolean
  dir?: 'rtl' | 'ltr'
}

export const LookupSelect = React.memo(function LookupSelect({
  value = '',
  onChange,
  placeholder = 'בחר או הקלד...',
  lookupType,
  className = '',
  disabled = false,
  dir = 'rtl'
}: LookupSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const lastPropValueRef = useRef(value)
  const lastSentValueRef = useRef(value)
  const inputValueRef = useRef(value)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const updateValueInternal = useCallback((val: string) => {
    setInputValue(val)
    inputValueRef.current = val
  }, [])

  // Derived state pattern to sync with props
  if (value !== lastPropValueRef.current) {
    lastPropValueRef.current = value
    lastSentValueRef.current = value
    setInputValue(value)
    inputValueRef.current = value
  }

  const {
    data: options,
    loading,
    createItem,
    isCreating: creating
  } = useLookupData(lookupType)

  const [filteredOptions, setFilteredOptions] = useState<LookupItem[]>([])

  const handleSync = useCallback(() => {
    const val = inputValueRef.current;
    if (typeof onChange === 'function' && val !== lastSentValueRef.current) {
      flushSync(() => {
        onChange(val)
      })
      lastSentValueRef.current = val
    }
    inputSyncManager.unregister(handleSync)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [onChange])

  // Debounce the parent update
  useEffect(() => {
    if (inputValue === lastSentValueRef.current) return

    inputSyncManager.register(handleSync)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(handleSync, 1000)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [inputValue, handleSync])

  // Cleanup/Sync on unmount
  useEffect(() => {
    return () => {
      handleSync()
    }
  }, [handleSync])

  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredOptions(options)
    } else {
      const filtered = options.filter(option =>
        option.name.toLowerCase().includes(inputValue.toLowerCase())
      )
      setFilteredOptions(filtered)
    }
  }, [inputValue, options])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    updateValueInternal(newValue)
    setIsOpen(true)
  }

  const handleOptionSelect = (option: LookupItem) => {
    updateValueInternal(option.name)
    lastSentValueRef.current = option.name
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    inputSyncManager.unregister(handleSync)

    if (typeof onChange === 'function') {
      flushSync(() => {
        onChange(option.name)
      })
    }
    setIsOpen(false)
  }


  const handleCreateNew = async () => {
    if (!inputValue.trim()) return

    try {
      const newItem = await createItem(inputValue.trim())
      if (newItem) {
        updateValueInternal(newItem.name)
        lastSentValueRef.current = newItem.name
        
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
        inputSyncManager.unregister(handleSync)

        flushSync(() => {
          onChange(newItem.name)
        })
        setIsOpen(false)
        toast.success('פריט חדש נוצר בהצלחה')
      } else {
        toast.error('שגיאה ביצירת פריט חדש')
      }
    } catch (error) {
      console.error('Error creating new item:', error)
      toast.error('שגיאה ביצירת פריט חדש')
    }
  }

  const exactMatch = filteredOptions.find(option =>
    option.name.toLowerCase() === inputValue.toLowerCase()
  )

  const showCreateOption = inputValue.trim() && !exactMatch && !loading

  return (
    <div ref={containerRef} className={`relative ${className} dark:bg-card`}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`text-right pl-5 ${!disabled ? 'bg-card' : 'bg-accent/50 dark:bg-accent/50'} disabled:opacity-100 disabled:cursor-default ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
          dir={dir}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute w-7 left-0 top-0 h-full px-1 hover:bg-transparent"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <IconChevronDown size={6} className={`transition-transform size-[14px] text-muted-foreground ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {isOpen && (
        <Card className="absolute gap-1 z-50 w-full mt-1 p-1 shadow-lg border max-h-60 overflow-auto" style={{ scrollbarWidth: 'none' }}>
          {loading ? (
            <div className="px-2 py-1 text-center text-muted-foreground">טוען...</div>
          ) : (
            <>
              {filteredOptions.length === 0 && !showCreateOption ? (
                <div className="px-2 py-1 text-center text-muted-foreground">אין תוצאות</div>
              ) : (
                <>
                  {filteredOptions.map((option) => (
                    <div
                      key={option.id}
                      className="flex gap-1 items-center px-2 py-1 cursor-pointer hover:bg-accent rounded-sm"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleOptionSelect(option)
                      }}
                    >
                      <div className="flex items-center">
                        {option.name === inputValue && (
                          <IconCheck className="h-4 w-4 text-primary ml-1" />
                        )}
                      </div>
                      <span className="text-right flex-1">{option.name}</span>
                    </div>
                  ))}

                  {showCreateOption && (
                    <div
                      className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-accent rounded-sm border-t"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleCreateNew()
                      }}
                    >
                      <div className="flex items-center">
                        <IconPlus className="h-4 w-4 text-green-600 ml-1" />
                        {creating && (
                          <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin ml-1" />
                        )}
                      </div>
                      <span className="text-right flex-1 text-green-600">
                        צור "{inputValue}"
                      </span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  )
})
