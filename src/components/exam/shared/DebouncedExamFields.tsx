import React from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface DebouncedExamInputProps extends React.ComponentProps<typeof Input> {
    onValueChange: (value: string) => void
    debounceMs?: number
}

export function DebouncedExamInput({
    value: propValue,
    onValueChange,
    debounceMs = 500,
    ...props
}: DebouncedExamInputProps) {
    const stringValue = propValue?.toString() || ""
    const [localValue, setLocalValue] = React.useState(stringValue)
    const lastSentValueRef = React.useRef(stringValue)

    // Sync with prop if it changes externally
    React.useEffect(() => {
        const isLocalDirty = localValue !== lastSentValueRef.current
        if (!isLocalDirty && propValue !== localValue) {
            if (stringValue.trim() !== localValue.trim()) {
                setLocalValue(stringValue)
            }
            lastSentValueRef.current = stringValue
        }
    }, [propValue, localValue, stringValue])

    // Debounce the parent onChange call
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (localValue !== lastSentValueRef.current) {
                onValueChange(localValue)
                lastSentValueRef.current = localValue
            }
        }, debounceMs)

        return () => clearTimeout(timer)
    }, [localValue, onValueChange, debounceMs])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value)
    }

    return <Input {...props} value={localValue} onChange={handleChange} />
}

interface DebouncedExamTextareaProps extends React.ComponentProps<typeof Textarea> {
    onValueChange: (value: string) => void
    debounceMs?: number
}

export function DebouncedExamTextarea({
    value: propValue,
    onValueChange,
    debounceMs = 500,
    ...props
}: DebouncedExamTextareaProps) {
    const stringValue = propValue?.toString() || ""
    const [localValue, setLocalValue] = React.useState(stringValue)
    const lastSentValueRef = React.useRef(stringValue)

    // Sync with prop if it changes externally
    React.useEffect(() => {
        const isLocalDirty = localValue !== lastSentValueRef.current
        if (!isLocalDirty && propValue !== localValue) {
            if (stringValue.trim() !== localValue.trim()) {
                setLocalValue(stringValue)
            }
            lastSentValueRef.current = stringValue
        }
    }, [propValue, localValue, stringValue])

    // Debounce the parent onChange call
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (localValue !== lastSentValueRef.current) {
                onValueChange(localValue)
                lastSentValueRef.current = localValue
            }
        }, debounceMs)

        return () => clearTimeout(timer)
    }, [localValue, onValueChange, debounceMs])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLocalValue(e.target.value)
    }

    return <Textarea {...props} value={localValue} onChange={handleChange} />
}
