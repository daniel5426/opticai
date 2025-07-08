import React, { useState, useEffect, useRef } from 'react'
import { Input } from './input'
import { Button } from './button'
import { Card } from './card'
import { IconChevronDown, IconPlus, IconCheck } from '@tabler/icons-react'
import { toast } from 'sonner'
import * as lookupDb from '@/lib/db/lookup-db'

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

export function LookupSelect({
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
  const [options, setOptions] = useState<LookupItem[]>([])
  const [filteredOptions, setFilteredOptions] = useState<LookupItem[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const getLookupFunctions = (type: string) => {
    const lookupMap: { [key: string]: any } = {
      supplier: {
        getAll: lookupDb.getAllLookupSuppliers,
        create: lookupDb.createLookupSupplier
      },
      clinic: {
        getAll: lookupDb.getAllLookupClinics,
        create: lookupDb.createLookupClinic
      },
      orderType: {
        getAll: lookupDb.getAllLookupOrderTypes,
        create: lookupDb.createLookupOrderType
      },
      referralType: {
        getAll: lookupDb.getAllLookupReferralTypes,
        create: lookupDb.createLookupReferralType
      },
      lensModel: {
        getAll: lookupDb.getAllLookupLensModels,
        create: lookupDb.createLookupLensModel
      },
      color: {
        getAll: lookupDb.getAllLookupColors,
        create: lookupDb.createLookupColor
      },
      material: {
        getAll: lookupDb.getAllLookupMaterials,
        create: lookupDb.createLookupMaterial
      },
      coating: {
        getAll: lookupDb.getAllLookupCoatings,
        create: lookupDb.createLookupCoating
      },
      manufacturer: {
        getAll: lookupDb.getAllLookupManufacturers,
        create: lookupDb.createLookupManufacturer
      },
      frameModel: {
        getAll: lookupDb.getAllLookupFrameModels,
        create: lookupDb.createLookupFrameModel
      },
      contactLensType: {
        getAll: lookupDb.getAllLookupContactLensTypes,
        create: lookupDb.createLookupContactLensType
      },
      contactEyeLensType: {
        getAll: lookupDb.getAllLookupContactEyeLensTypes,
        create: lookupDb.createLookupContactEyeLensType
      },
      contactEyeMaterial: {
        getAll: lookupDb.getAllLookupContactEyeMaterials,
        create: lookupDb.createLookupContactEyeMaterial
      },
      cleaningSolution: {
        getAll: lookupDb.getAllLookupCleaningSolutions,
        create: lookupDb.createLookupCleaningSolution
      },
      disinfectionSolution: {
        getAll: lookupDb.getAllLookupDisinfectionSolutions,
        create: lookupDb.createLookupDisinfectionSolution
      },
      rinsingSolution: {
        getAll: lookupDb.getAllLookupRinsingSolutions,
        create: lookupDb.createLookupRinsingSolution
      },
      manufacturingLab: {
        getAll: lookupDb.getAllLookupManufacturingLabs,
        create: lookupDb.createLookupManufacturingLab
      },
      advisor: {
        getAll: lookupDb.getAllLookupAdvisors,
        create: lookupDb.createLookupAdvisor
      }
    }
    return lookupMap[type] || null
  }

  const loadOptions = async () => {
    const functions = getLookupFunctions(lookupType)
    if (!functions?.getAll) return

    try {
      setLoading(true)
      const data = await functions.getAll()
      setOptions(data || [])
      setFilteredOptions(data || [])
    } catch (error) {
      console.error(`Error loading ${lookupType} options:`, error)
      setOptions([])
      setFilteredOptions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOptions()
  }, [lookupType])

  useEffect(() => {
    setInputValue(value)
  }, [value])

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
    setInputValue(newValue)
    onChange(newValue)
    setIsOpen(true)
  }

  const handleOptionSelect = (option: LookupItem) => {
    setInputValue(option.name)
    onChange(option.name)
    setIsOpen(false)
  }

  const handleCreateNew = async () => {
    if (!inputValue.trim()) return

    const functions = getLookupFunctions(lookupType)
    if (!functions?.create) return

    try {
      setCreating(true)
      const newItem = await functions.create({ name: inputValue.trim() })
      if (newItem) {
        setOptions(prev => [...prev, newItem])
        setFilteredOptions(prev => [...prev, newItem])
        setInputValue(newItem.name)
        onChange(newItem.name)
        setIsOpen(false)
        toast.success('פריט חדש נוצר בהצלחה')
      } else {
        toast.error('שגיאה ביצירת פריט חדש')
      }
    } catch (error) {
      console.error('Error creating new item:', error)
      toast.error('שגיאה ביצירת פריט חדש')
    } finally {
      setCreating(false)
    }
  }

  const exactMatch = filteredOptions.find(option => 
    option.name.toLowerCase() === inputValue.toLowerCase()
  )

  const showCreateOption = inputValue.trim() && !exactMatch && !loading

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`text-right pl-10 ${!disabled ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
          dir={dir}
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
        <Card className="absolute gap-1 z-50 w-full mt-1 p-1 shadow-lg border max-h-60 overflow-auto" style={{scrollbarWidth: 'none'}}>
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
                      onClick={() => handleOptionSelect(option)}
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
                      onClick={handleCreateNew}
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
} 