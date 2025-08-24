import React from "react"

interface ImageInputProps {
  value?: string
  onChange: (value: string) => void
  onRemove?: () => void
  size?: number // pixels
  shape?: "circle" | "rounded"
  fit?: "cover" | "contain"
  alt?: string
  disabled?: boolean
  className?: string
}

export function ImageInput({
  value,
  onChange,
  onRemove,
  size = 96,
  shape = "rounded",
  fit = "cover",
  alt = "",
  disabled = false,
  className = "",
}: ImageInputProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (result) onChange(result)
    }
    reader.readAsDataURL(file)
  }

  const dimensionStyle: React.CSSProperties = { width: size, height: size }
  const roundedClass = shape === "circle" ? "rounded-full" : "rounded-lg"
  const objectFitClass = fit === "contain" ? "object-contain" : "object-cover"

  return (
    <div className={`relative ${className}`} dir="rtl">
      <div
        className={`shadow-md bg-muted overflow-hidden ring-1 ring-border ${roundedClass} flex items-center justify-center`}
        style={dimensionStyle}
      >
        {value ? (
          <img
            src={value}
            alt={alt}
            className={`w-full h-full ${objectFitClass} ${roundedClass}`}
          />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="w-8 h-8 text-muted-foreground"
          >
            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {!disabled && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`absolute bottom-1 left-1 h-7 w-7 ${roundedClass} bg-background/80 backdrop-blur border shadow flex items-center justify-center hover:bg-background`}
            title="בחר תמונה"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </>
      )}

      {value && onRemove && !disabled ? (
        <button
          type="button"
          onClick={() => onRemove?.()}
          className={`absolute bottom-1 right-1 h-7 w-7 ${roundedClass} bg-background/80 backdrop-blur border shadow flex items-center justify-center hover:bg-background`}
          title="הסר"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

export default ImageInput


