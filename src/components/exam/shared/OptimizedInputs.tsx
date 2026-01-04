import React, { useEffect, useRef, memo, useState, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Maximize2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/utils/tailwind";
import { flushSync } from 'react-dom';

/**
 * Simple manager to track and flush pending updates from optimized components.
 */
class SyncManager {
    private pendingSyncs = new Set<() => void>();

    register(syncFn: () => void) {
        this.pendingSyncs.add(syncFn);
    }

    unregister(syncFn: () => void) {
        this.pendingSyncs.delete(syncFn);
    }

    /**
     * Executes all pending sync operations immediately.
     */
    flush() {
        this.pendingSyncs.forEach(sync => {
            try { sync(); } catch (e) { console.error("Sync error:", e); }
        });
        this.pendingSyncs.clear();
    }
}

export const inputSyncManager = new SyncManager();

export function useOptimizedInput<T extends HTMLInputElement | HTMLTextAreaElement>(
    value: string,
    onChange?: (val: string) => void,
    debounceMs: number = 1500,
    onBlurOverride?: () => void
) {
    const inputRef = useRef<T>(null);
    const lastSentValueRef = useRef(value);
    const localValueRef = useRef(value);

    // Sync with prop if it changes externally
    useEffect(() => {
        if (value !== localValueRef.current) {
            localValueRef.current = value;
        }

        if (inputRef.current && value !== inputRef.current.value) {
            // Only update DOM if significantly different to avoid cursor jumps
            // But for safety against "empty string" bugs, we trust the prop if it differs
            if (value !== inputRef.current.value) {
                const isDirty = inputRef.current.value !== lastSentValueRef.current;

                // If the user hasn't typed anything pending, safe to update
                // Or if the value is just different.
                // The original logic checked trims. Let's stick to the core need: data consistency.

                if (value.trim() !== inputRef.current.value.trim()) {
                    inputRef.current.value = value;
                    lastSentValueRef.current = value;

                    // Custom logic for auto-resizing textareas if needed
                    if (inputRef.current instanceof HTMLTextAreaElement) {
                        const mirror = inputRef.current.parentElement?.querySelector('[aria-hidden="true"]');
                        if (mirror instanceof HTMLElement) {
                            mirror.textContent = value + " ";
                        }
                    }
                }
            }
        }
    }, [value]);

    useEffect(() => {
        let timer: NodeJS.Timeout;

        const handleSync = () => {
            // IMPORTANT: If inputRef.current is null (unmounting), fallback to localValueRef
            const currentVal = inputRef.current ? inputRef.current.value : localValueRef.current;

            if (currentVal !== lastSentValueRef.current) {
                if (typeof onChange === 'function') {
                    // Use flushSync to ensure the parent state update is processed immediately
                    flushSync(() => {
                        onChange!(currentVal);
                    });
                }
                lastSentValueRef.current = currentVal;
            }
            inputSyncManager.unregister(handleSync);
        };

        const onInput = (e: Event) => {
            const target = e.target as T;
            localValueRef.current = target.value;

            inputSyncManager.register(handleSync);
            if (timer) clearTimeout(timer);
            timer = setTimeout(handleSync, debounceMs);
        };

        const element = inputRef.current;
        if (element) {
            element.addEventListener('input', onInput);
            element.addEventListener('blur', () => {
                // Ensure we capture latest value on blur before syncing
                if (inputRef.current) localValueRef.current = inputRef.current.value;
                handleSync();
                if (onBlurOverride) onBlurOverride();
            });
        }

        return () => {
            if (element) {
                element.removeEventListener('input', onInput);
                element.removeEventListener('blur', handleSync);
            }
            if (timer) clearTimeout(timer);
            handleSync();
        };
    }, [onChange, debounceMs, onBlurOverride]);

    return { inputRef, lastSentValueRef };
}

/**
 * A custom hook to handle synchronization and debouncing for Select components.
 */
export function useOptimizedSelect(
    value: string,
    onChange?: (val: string) => void,
    debounceMs: number = 1000
) {
    const [localValue, setLocalValue] = useState(value);
    const lastPropValueRef = useRef(value);
    const localValueRef = useRef(value);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Keep ref in sync for the sync manager
    useEffect(() => {
        localValueRef.current = localValue;
    }, [localValue]);

    // Sync with prop if it changes externally
    useEffect(() => {
        if (value !== lastPropValueRef.current) {
            setLocalValue(value);
            localValueRef.current = value;
            lastPropValueRef.current = value;
        }
    }, [value]);

    const handleSync = useCallback(() => {
        const val = localValueRef.current;
        if (typeof onChange === 'function' && val !== lastPropValueRef.current) {
            flushSync(() => {
                onChange(val);
            });
            lastPropValueRef.current = val;
        }
        inputSyncManager.unregister(handleSync);
    }, [onChange]);

    const handleValueChange = useCallback((val: string) => {
        setLocalValue(val);
        localValueRef.current = val;
        inputSyncManager.register(handleSync);

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(handleSync, debounceMs);
    }, [handleSync, debounceMs]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            handleSync();
        };
    }, [handleSync]);

    return { localValue, handleValueChange };
}



/**
 * Memoized mirror component to prevent React from overwriting manual DOM updates.
 * Captures initial value and ignores subsequent value prop updates to children.
 */
const TextareaMirror = memo(React.forwardRef<HTMLDivElement, { className?: string, value: string }>(
    ({ className, value }, ref) => {
        return (
            <div
                ref={ref}
                className={className}
                aria-hidden="true"
            >
                {value + " "}
            </div>
        );
    }
));

interface FastInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> {
    value: string;
    onChange?: (value: string) => void;
    debounceMs?: number;
}

export const FastInput = memo(function FastInput({
    value,
    onChange,
    debounceMs = 1500,
    ...props
}: FastInputProps) {
    const { inputRef } = useOptimizedInput<HTMLInputElement>(value, onChange, debounceMs);

    return <Input {...props} ref={inputRef} defaultValue={value} />;
});

interface FastTextareaProps extends Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange'> {
    value: string;
    onChange?: (value: string) => void;
    debounceMs?: number;
    label?: string; // Used for the dialog title
    showMaximize?: boolean;
}

export const FastTextarea = memo(function FastTextarea({
    value,
    onChange,
    debounceMs = 2000,
    label,
    showMaximize = false,
    className,
    ...props
}: FastTextareaProps) {
    const mirrorRef = useRef<HTMLDivElement>(null);
    const { inputRef: textareaRef } = useOptimizedInput<HTMLTextAreaElement>(value, onChange, debounceMs);
    const [initialValue] = useState(value); // Capture initial value once to stabilize mirror


    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;

        let rafId: number;

        const updateMirror = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                if (mirrorRef.current) mirrorRef.current.textContent = el.value + " ";
            });
        };

        // Initialize mirror
        updateMirror();

        el.addEventListener('input', updateMirror);
        return () => {
            el.removeEventListener('input', updateMirror);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [textareaRef]);

    return (
        <div className="relative group/field flex-1 grid">
            {/* Hidden div that drives the height - Managed via Ref for speed */}
            <TextareaMirror
                ref={mirrorRef}
                className={cn(
                    "col-start-1 row-start-1 bg-transparent invisible whitespace-pre-wrap min-h-[40px] px-2 py-2 text-sm pointer-events-none border border-transparent",
                    showMaximize && "pl-10",
                    className
                )}
                value={initialValue}
            />

            <Textarea
                {...props}
                ref={textareaRef}
                defaultValue={value}
                className={cn(
                    "col-start-1 row-start-1 w-full h-full min-h-[40px] px-2 py-2 text-sm resize-none overflow-hidden bg-white disabled:bg-accent/50 disabled:opacity-100 disabled:cursor-default",
                    showMaximize && "pl-10",
                    className
                )}
                spellCheck={false}
                rows={1}
            />

            {showMaximize && (
                <div className="absolute top-1 left-1 z-10">
                    <Dialog>
                        <DialogTrigger asChild>
                            <button
                                className="p-2 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-foreground"
                                title="מסך מלא"
                            >
                                <Maximize2 className="h-4 w-4" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl sm:max-w-[800px]">
                            <DialogHeader>
                                <DialogTitle className="text-right">{label || 'ערוך'}</DialogTitle>
                            </DialogHeader>
                            <div className="mt-4" dir="rtl">
                                <FastTextarea
                                    value={value}
                                    onChange={onChange}
                                    debounceMs={debounceMs}
                                    disabled={props.disabled}
                                    className="min-h-[500px] text-base p-4"
                                    placeholder={props.disabled ? "" : `הקלד...`}
                                    showMaximize={false}
                                />
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            )}
        </div>
    );
});

interface FastSelectProps extends Omit<React.ComponentProps<typeof Select>, 'value' | 'onValueChange'> {
    value: string;
    onChange?: (value: string) => void;
    debounceMs?: number;
    placeholder?: string;
    options: readonly string[] | readonly { value: string; label: string }[];
    triggerClassName?: string;
    size?: "default" | "sm" | "xs";
}


export const FastSelect = memo(function FastSelect({
    value,
    onChange,
    debounceMs = 1000,
    placeholder = "",
    options,
    triggerClassName,
    size = "default",
    ...props
}: FastSelectProps) {
    const { localValue, handleValueChange } = useOptimizedSelect(value, onChange, debounceMs);

    return (
        <Select {...props} value={localValue} onValueChange={handleValueChange}>
            <SelectTrigger disabled={props.disabled} size={size} className={triggerClassName}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {options.map((opt) => {
                    const val = typeof opt === 'string' ? opt : opt.value;
                    const label = typeof opt === 'string' ? opt : opt.label;
                    return (
                        <SelectItem key={val} value={val}>
                            {label}
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
});

