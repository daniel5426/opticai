import React, { useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DiopterAdjustmentPanel } from "@/lib/db/schema"
import { Plus, Minus } from "lucide-react"

interface DiopterAdjustmentPanelTabProps {
  diopterData: DiopterAdjustmentPanel
  onDiopterChange: (field: keyof DiopterAdjustmentPanel, value: string) => void
  isEditing: boolean
}

export function DiopterAdjustmentPanelTab({
  diopterData,
  onDiopterChange,
  isEditing
}: DiopterAdjustmentPanelTabProps) {
  const [rightDeviation, setRightDeviation] = useState(0)
  const [leftDeviation, setLeftDeviation] = useState(0)
  const [pulse, setPulse] = useState<'right' | 'left' | null>(null)
  const maxDeviation = 10
  const pxPerUnit = 1
  const dotBaseX = 55
  const dotBaseY = 55
  const dotRadius = 6
  const circleRadius = 40
  const maxAngle = Math.PI // 180 degrees (bottom half of the circle)
  const animateDot = (side: 'right' | 'left', outward: boolean) => {
    const step = 0.25
    if (side === 'right') {
      setRightDeviation(prev => {
        let next = outward ? prev + step : prev - step
        if (next > maxDeviation) next = maxDeviation
        if (next < -maxDeviation) next = -maxDeviation
        return Math.round(next * 100) / 100
      })
      setPulse('right')
      setTimeout(() => setPulse(null), 250)
    } else {
      setLeftDeviation(prev => {
        let next = outward ? prev + step : prev - step
        if (next > maxDeviation) next = maxDeviation
        if (next < -maxDeviation) next = -maxDeviation
        return Math.round(next * 100) / 100
      })
      setPulse('left')
      setTimeout(() => setPulse(null), 250)
    }
  }
  const handleAdjust = (eye: 'right_diopter' | 'left_diopter', delta: number) => {
    if (!isEditing) return
    const current = typeof diopterData[eye] === 'number' ? (diopterData[eye] as number) : 0
    const next = Math.round((current + delta) * 100) / 100
    onDiopterChange(eye, next.toString())
    if (eye === 'right_diopter') animateDot('right', delta > 0)
    else animateDot('left', delta > 0)
  }
  const holdTimeout = useRef<NodeJS.Timeout | null>(null)
  const holdInterval = useRef<NodeJS.Timeout | null>(null)
  const handleButtonHold = (field: 'right_diopter' | 'left_diopter', delta: number) => {
    holdTimeout.current = setTimeout(() => {
      holdInterval.current = setInterval(() => {
        handleAdjust(field, delta)
      }, 60)
    }, 1000)
  }
  const clearButtonHold = () => {
    if (holdTimeout.current) clearTimeout(holdTimeout.current)
    if (holdInterval.current) clearInterval(holdInterval.current)
    holdTimeout.current = null
    holdInterval.current = null
  }
  const renderEye = (side: 'right' | 'left') => {
    const field = side === 'right' ? 'right_diopter' : 'left_diopter'
    const value = diopterData[field] ?? 0
    const deviation = side === 'right' ? rightDeviation : leftDeviation
    let clampedDeviation = deviation
    if (clampedDeviation > maxDeviation) clampedDeviation = maxDeviation
    if (clampedDeviation < -maxDeviation) clampedDeviation = -maxDeviation
    // Map deviation to angle: -maxDeviation = π (left), 0 = π/2 (bottom), +maxDeviation = 0 (right)
    let angle = ((-clampedDeviation + maxDeviation) / (2 * maxDeviation)) * Math.PI
    if (side === 'left') angle = Math.PI - angle
    const theta = angle
    const dotX = dotBaseX + circleRadius * Math.cos(theta)
    const dotY = dotBaseY + circleRadius * Math.sin(theta)
    return (
      <div style={{ direction: 'rtl', padding: 24, borderRadius: 8 }} className="bg-accent/50 shadow-md">
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <span style={{ fontFamily: 'Inter, Montserrat, Arial, sans-serif', fontSize: 14, fontWeight: 500}}>
            {side === 'right' ? 'ימין' : 'שמאל'} = {deviation}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
          <svg width={110} height={110} style={{ display: 'block' }}>
            <circle cx={55} cy={55} r={54} fill="#E6F7E9" stroke="none" />
            {(() => {
              const svgWidth = 110
              const lineWidth = 20
              const lineHeight = 3
              const leftX = 0
              const rightX = svgWidth - lineWidth
              const y = 53
              const lighter = '#B6E7A0'
              const lighterOffset = 7
              // For angled lighter lines
              const centerX = 55
              const centerY = 55
              const angleFraction = 0.4 // 0 = at line end, 1 = at center
              // Left side above
              const leftStartX = leftX
              const leftStartYAbove = y - lighterOffset
              const leftEndXAbove = leftStartX + (centerX - leftStartX) * angleFraction
              const leftEndYAbove = leftStartYAbove + (centerY - leftStartYAbove) * angleFraction
              // Left side below
              const leftStartYBelow = y + lineHeight + lighterOffset
              const leftEndXBelow = leftStartX + (centerX - leftStartX) * angleFraction
              const leftEndYBelow = leftStartYBelow + (centerY - leftStartYBelow) * angleFraction
              // Right side above
              const rightStartX = rightX + lineWidth
              const rightStartYAbove = y - lighterOffset
              const rightEndXAbove = rightStartX + (centerX - rightStartX) * angleFraction
              const rightEndYAbove = rightStartYAbove + (centerY - rightStartYAbove) * angleFraction
              // Right side below
              const rightStartYBelow = y + lineHeight + lighterOffset
              const rightEndXBelow = rightStartX + (centerX - rightStartX) * angleFraction
              const rightEndYBelow = rightStartYBelow + (centerY - rightStartYBelow) * angleFraction
              return (
                <>
                  <rect x={leftX} y={y} width={lineWidth} height={lineHeight} rx={2} fill="#8BC34A" />
                  <line x1={leftStartX} y1={leftStartYAbove} x2={leftEndXAbove} y2={leftEndYAbove} stroke={lighter} strokeWidth={2} />
                  <line x1={leftStartX} y1={leftStartYBelow} x2={leftEndXBelow} y2={leftEndYBelow} stroke={lighter} strokeWidth={2} />
                  <rect x={rightX} y={y} width={lineWidth} height={lineHeight} rx={2} fill="#8BC34A" />
                  <line x1={rightStartX} y1={rightStartYAbove} x2={rightEndXAbove} y2={rightEndYAbove} stroke={lighter} strokeWidth={2} />
                  <line x1={rightStartX} y1={rightStartYBelow} x2={rightEndXBelow} y2={rightEndYBelow} stroke={lighter} strokeWidth={2} />
                </>
              )
            })()}
            <circle cx={55} cy={55} r={54} fill="none" stroke="#333" strokeWidth={2} />
            <g>
              <circle
                cx={dotX}
                cy={dotY}
                r={dotRadius}
                fill="#D81B60"
                style={{
                  transition: 'cx 0.25s cubic-bezier(0.4,0,0.2,1), cy 0.25s cubic-bezier(0.4,0,0.2,1)',
                }}
                className={pulse === side ? 'dot-pulse' : ''}
              />
            </g>
          </svg>
        </div>
        <div className="border bg-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: 9999, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: 95, margin: '0 auto' }}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="bg-card"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid #E53935',
              boxShadow: '0 1px 4px rgba(229,57,53,0.08)',
              transition: 'all 0.15s',
              marginRight: 0,
              marginLeft: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              color: '#E53935',
              fontSize: 20,
              outline: 'none',
              cursor: isEditing ? 'pointer' : 'default',
              opacity: isEditing ? 1 : 0.5,
              transform: 'scale(1)',
            }}
            onClick={() => handleAdjust(field, 0.25)}
            disabled={!isEditing}
            onMouseDown={e => {
              e.currentTarget.style.transform = 'scale(1.05)'
              handleButtonHold(field, 0.25)
            }}
            onMouseUp={e => {
              e.currentTarget.style.transform = 'scale(1)'
              clearButtonHold()
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)'
              clearButtonHold()
            }}
          >
            <Plus />
          </Button>
          <div style={{  height: 44, margin: '0 8px' } } className="shadow-md" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="bg-card"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid #555',
              boxShadow: '0 1px 4px rgba(85,85,85,0.08)',
              transition: 'all 0.15s',
              marginRight: 0,
              marginLeft: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              color: '#555',
              fontSize: 20,
              outline: 'none',
              cursor: isEditing ? 'pointer' : 'default',
              opacity: isEditing ? 1 : 0.5,
              transform: 'scale(1)',
            }}
            onClick={() => handleAdjust(field, -0.25)}
            disabled={!isEditing}
            onMouseDown={e => {
              e.currentTarget.style.transform = 'scale(1.05)'
              handleButtonHold(field, -0.25)
            }}
            onMouseUp={e => {
              e.currentTarget.style.transform = 'scale(1)'
              clearButtonHold()
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)'
              clearButtonHold()
            }}
          >
            <Minus />
          </Button>
        </div>
      </div>
    )
  }
  return (
    <Card className="w-full shadow-md pb-4 pt-3 border-none" style={{ direction: 'rtl' ,  width: 365}}>
      <CardContent className="px-4 flex flex-row justify-center gap-4" style={{ scrollbarWidth: 'none', margin: '0 auto' }}>
        {renderEye('right')}
        {renderEye('left')}
      </CardContent>
    </Card>
  )
} 