import React from 'react'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { FastTextarea } from '../exam/shared/OptimizedInputs'
import { Maximize2, FileText, Lock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type NotesCardProps = {
  title: React.ReactNode
  value: string
  onChange: (value: string) => void
  hiddenValue?: string
  onHiddenChange?: (value: string) => void
  disabled?: boolean
  placeholder?: string
  height?: string
}

export function NotesCard({
  title,
  value,
  onChange,
  hiddenValue = '',
  onHiddenChange,
  disabled = false,
  placeholder = '',
  height = 'full',
}: NotesCardProps) {
  const [isShowingHidden, setIsShowingHidden] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogIsShowingHidden, setDialogIsShowingHidden] = React.useState(false)
  const [dialogRegularValue, setDialogRegularValue] = React.useState(value)
  const [dialogHiddenValue, setDialogHiddenValue] = React.useState(hiddenValue)

  const currentDisplayValue = isShowingHidden ? hiddenValue : value
  const dialogDisplayValue = dialogIsShowingHidden ? dialogHiddenValue : dialogRegularValue
  
  const handleCurrentChange = (val: string) => {
    if (isShowingHidden) {
      onHiddenChange?.(val)
    } else {
      onChange(val)
    }
  }

  const handleDialogChange = (val: string) => {
    if (dialogIsShowingHidden) {
      setDialogHiddenValue(val)
      onHiddenChange?.(val)
    } else {
      setDialogRegularValue(val)
      onChange(val)
    }
  }

  const hasHiddenContent = hiddenValue && hiddenValue.length > 0

  React.useEffect(() => {
    if (dialogOpen) {
      setDialogIsShowingHidden(isShowingHidden)
      setDialogRegularValue(value)
      setDialogHiddenValue(hiddenValue)
    }
  }, [dialogOpen, isShowingHidden, value, hiddenValue])

  return (
    <Card
      className={`w-full px-4 pt-3 pb-4 gap-2 transition-all duration-500 ease-in-out relative overflow-hidden group/card ${isShowingHidden ? 'bg-zinc-900 text-zinc-100 border-zinc-800' : ''
        }`}
      dir="rtl"
    >
      {/* Propagation effect layer */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${isShowingHidden ? 'opacity-20' : 'opacity-0'
          }`}
        style={{
          background: 'radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.1) 0%, transparent 60%)',
        }}
      />

      <div className="flex items-center gap-3 relative z-10">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <div className={`p-2 rounded-lg cursor-pointer group/expand transition-colors ${isShowingHidden ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-muted hover:bg-accent'
              }`}>
              <FileText className={`h-4 w-4 group-hover/expand:hidden ${isShowingHidden ? 'text-zinc-400' : 'text-foreground'}`} />
              <Maximize2 className={`h-4 w-4 hidden group-hover/expand:block ${isShowingHidden ? 'text-zinc-100' : 'text-foreground'}`} />
            </div>
          </DialogTrigger>
          <DialogContent className={`max-w-4xl sm:max-w-[800px] ${dialogIsShowingHidden ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : ''}`}>
            <DialogHeader>
              <DialogTitle className={`text-right ${dialogIsShowingHidden ? 'text-zinc-100' : ''}`}>
                {dialogIsShowingHidden ? <span className="">הערה נסתרת</span> : title}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4 relative" dir="rtl">
              <FastTextarea
                disabled={disabled}
                value={dialogDisplayValue || ''}
                noBorder={true}
                onChange={handleDialogChange}
                className={`min-h-[500px] text-base p-4 ${dialogIsShowingHidden ? 'bg-transparent text-zinc-100 placeholder:text-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 border-none resize-none' : 'focus-visible:ring-0 focus-visible:ring-offset-0 border-none resize-none'}`}
                placeholder={disabled ? '' : placeholder}
                showMaximize={false}
              />
              {/* Secret Toggle in Modal */}
              {onHiddenChange && (
                <div className="absolute bottom-4 left-4 z-20">
                  <div
                    onClick={() => setDialogIsShowingHidden(!dialogIsShowingHidden)}
                    className={`p-2 rounded-full cursor-pointer transition-all duration-300 ${dialogIsShowingHidden ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-muted hover:bg-accent'
                      }`}
                  >
                    <Lock className={`h-4 w-4 ${dialogIsShowingHidden ? 'text-blue-400' : 'text-muted-foreground'}`} />
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        <h3 className={`text-base font-medium transition-colors ${isShowingHidden ? 'text-zinc-400' : 'text-muted-foreground'}`}>{isShowingHidden ? 'הערה נסתרת' : title}</h3>
      </div>

      <FastTextarea
        disabled={disabled}
        value={currentDisplayValue || ''}
        onChange={handleCurrentChange}
        isSecret={isShowingHidden}
        style={height && height !== 'full' ? { height } : undefined}
        className={`text-sm w-full p-3 rounded-lg disabled:opacity-100 disabled:cursor-default min-h-[90px] transition-all duration-500 relative z-10 resize-none ${isShowingHidden
          ? disabled 
            ? 'bg-zinc-700/80 border-zinc-800 text-zinc-100 placeholder:text-zinc-600'
            : 'bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500'
          : ''
          } ${height === 'full' ? 'h-full flex-1' : ''}`}
        placeholder={disabled ? '' : placeholder}
        showMaximize={false}
      />

      {/* Secret Icon */}
      {onHiddenChange && (
        <div className="absolute bottom-2 left-2 z-20">
          <div
            onClick={() => setIsShowingHidden(!isShowingHidden)}
            className={`p-1.5 rounded-full cursor-pointer transition-all duration-300 opacity-0 group-hover/card:opacity-100 ${isShowingHidden ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-muted hover:bg-accent'
              }`}
          >
            <Lock className={`h-3 w-3 ${isShowingHidden ? 'text-blue-400' : 'text-muted-foreground'}`} />
          </div>
          {/* Blue dot indicator */}
          {hasHiddenContent && !isShowingHidden && (
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full border border-background transition-opacity duration-300 group-hover/card:opacity-0" />
          )}
        </div>
      )}
    </Card>
  )
}
