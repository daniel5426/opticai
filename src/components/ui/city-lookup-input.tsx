import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from './input'
import { Button } from './button'
import { Card } from './card'
import { IconChevronDown, IconCheck } from '@tabler/icons-react'
import israelCities from '@/utils/israel_cities.json'

interface CityLookupInputProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  dir?: 'rtl' | 'ltr'
}

export function CityLookupInput({
  value = '',
  onChange,
  placeholder = 'בחר או הקלד...',
  className = '',
  disabled = false,
  dir = 'rtl'
}: CityLookupInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)

  const options = useMemo(() => {
    if (Array.isArray(israelCities)) {
      return (israelCities as string[]).map((name, idx) => ({ id: idx, name }))
    }
    return [] as { id: number, name: string }[]
  }, [])

  const filteredOptions = useMemo(() => {
    const term = (inputValue || '').toLowerCase()
    if (!term) return options
    return options.filter(o => o.name.toLowerCase().includes(term))
  }, [inputValue, options])

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    if (highlightedIndex < 0) return
    const el = listRef.current?.querySelector(
      `[data-index="${highlightedIndex}"]`
    ) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, isOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    // Keep dropdown visible while typing to reflect filtering; does not auto-open on mere focus/click
    setIsOpen(true)
  }

  const handleOptionSelect = (name: string) => {
    setInputValue(name)
    onChange(name)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setHighlightedIndex(0)
        return
      }
      if (filteredOptions.length === 0) return
      setHighlightedIndex((prev) => {
        const next = Math.min((prev < 0 ? -1 : prev) + 1, filteredOptions.length - 1)
        return next
      })
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen || filteredOptions.length === 0) return
      setHighlightedIndex((prev) => {
        const base = prev < 0 ? 0 : prev
        const next = Math.max(base - 1, 0)
        return next
      })
      return
    }
    if (e.key === 'Home') {
      if (!isOpen || filteredOptions.length === 0) return
      e.preventDefault()
      setHighlightedIndex(0)
      return
    }
    if (e.key === 'End') {
      if (!isOpen || filteredOptions.length === 0) return
      e.preventDefault()
      setHighlightedIndex(filteredOptions.length - 1)
      return
    }
    if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        e.preventDefault()
        handleOptionSelect(filteredOptions[highlightedIndex].name)
      }
      return
    }
    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault()
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
      return
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className} dark:bg-card`}>
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`text-right pl-10 ${!disabled ? 'bg-card' : 'bg-accent/50 dark:bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute left-0 top-0 h-full px-3 hover:bg-transparent"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
        >
          <IconChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </div>

      {isOpen && (
        <Card ref={listRef} className="absolute gap-1 z-50 w-full mt-1 p-1 shadow-lg border max-h-60 overflow-auto" style={{ scrollbarWidth: 'none' }}>
          {filteredOptions.length === 0 ? (
            <div className="px-2 py-0.5 text-center text-muted-foreground">אין תוצאות</div>
          ) : (
            <>
              {filteredOptions.map((option, idx) => (
                <div
                  key={option.id}
                  data-index={idx}
                  className={`flex gap-1 items-center px-2 py-1 cursor-pointer rounded-sm ${idx === highlightedIndex ? 'bg-accent' : 'hover:bg-accent'}`}
                  onClick={() => handleOptionSelect(option.name)}
                >
                  <span className="text-right text-sm flex-1">{option.name}</span>
                  <div className="flex items-center">
                    {(option.name === inputValue || idx === highlightedIndex) && (
                      <IconCheck className="h-4 w-4 text-primary ml-1" />
                    )}
                  </div>

                </div>
              ))}
            </>
          )}
        </Card>
      )}
    </div>
  )
}


