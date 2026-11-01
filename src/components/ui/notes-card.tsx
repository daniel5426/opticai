import React from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
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
  className?: string
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
  className,
}: NotesCardProps) {
  const { t } = useTranslation()
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

  const hasHiddenContent = hiddenValue.length > 0

  React.useEffect(() => {
    if (dialogOpen) {
      setDialogIsShowingHidden(isShowingHidden)
      setDialogRegularValue(value)
      setDialogHiddenValue(hiddenValue)
    }
  }, [dialogOpen, isShowingHidden, value, hiddenValue])

  const heading = (showingHidden: boolean) => (showingHidden ? 'הערה נסתרת' : title)

  return (
    <Card
      className={cn(
        'relative w-full gap-2 px-4 pt-3 pb-4 transition-colors duration-300',
        height === 'full' && 'h-full',
        isShowingHidden && 'bg-primary/[0.04] ring-1 ring-primary/25',
        className,
      )}
      dir="rtl"
    >
      <div className="flex items-center gap-3">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={t('notesExpand')}
              className={cn(
                'group/expand rounded-lg p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isShowingHidden ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'bg-muted text-foreground hover:bg-accent',
              )}
            >
              {isShowingHidden
                ? <Lock className="h-4 w-4 group-hover/expand:hidden" />
                : <FileText className="h-4 w-4 group-hover/expand:hidden" />}
              <Maximize2 className="hidden h-4 w-4 group-hover/expand:block" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl sm:max-w-[800px]" dir="rtl">
            <DialogHeader>
              <div className="flex items-center justify-between gap-3 pe-8">
                <DialogTitle className={cn('flex items-center gap-2', dialogIsShowingHidden && 'text-primary')}>
                  {dialogIsShowingHidden && <Lock className="h-4 w-4" />}
                  {heading(dialogIsShowingHidden)}
                </DialogTitle>
                {onHiddenChange && (
                  <HiddenNoteToggle
                    active={dialogIsShowingHidden}
                    hasHiddenContent={dialogHiddenValue.length > 0}
                    onToggle={() => setDialogIsShowingHidden(!dialogIsShowingHidden)}
                  />
                )}
              </div>
            </DialogHeader>
            <div className="mt-2" dir="rtl">
              <FastTextarea
                disabled={disabled}
                value={dialogDisplayValue || ''}
                noBorder={true}
                onChange={handleDialogChange}
                className="min-h-[500px] resize-none border-none p-4 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder={disabled ? '' : placeholder}
                showMaximize={false}
                autoResize={false}
              />
            </div>
          </DialogContent>
        </Dialog>
        <h3 className={cn('text-base font-medium transition-colors', isShowingHidden ? 'text-primary' : 'text-muted-foreground')}>
          {heading(isShowingHidden)}
        </h3>
        {onHiddenChange && (
          <HiddenNoteToggle
            className="ms-auto"
            active={isShowingHidden}
            hasHiddenContent={hasHiddenContent}
            onToggle={() => setIsShowingHidden(!isShowingHidden)}
          />
        )}
      </div>

      <FastTextarea
        disabled={disabled}
        value={currentDisplayValue || ''}
        onChange={handleCurrentChange}
        isSecret={isShowingHidden}
        style={height && height !== 'full' ? { height } : undefined}
        className={cn(
          'min-h-[90px] w-full resize-none rounded-lg p-3 text-sm disabled:cursor-default disabled:opacity-100',
          height === 'full' && 'h-full flex-1',
        )}
        placeholder={disabled ? '' : placeholder}
        showMaximize={false}
        autoResize={false}
      />
    </Card>
  )
}

function HiddenNoteToggle({
  active,
  hasHiddenContent,
  onToggle,
  className,
}: {
  active: boolean
  hasHiddenContent: boolean
  onToggle: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const label = active ? t('notesShowRegular') : t('notesShowHidden')
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {active ? t('notesBackToNotes') : t('notesHiddenToggle')}
      {active ? <FileText className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
      {hasHiddenContent && !active && (
        <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full border border-background bg-primary" aria-hidden />
      )}
    </button>
  )
}
