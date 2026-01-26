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
import { UI_CONFIG } from '@/config/ui-config';

/**
 * A select component that adjusts its width based on the selected value.
 */
export const StretchSelect = memo(function StretchSelect({
    value,
    onChange,
    options,
    disabled = false,
    className = "",
    placeholder = "",
    size = "sm",
    centered = true
}: {
    value: string;
    onChange?: (value: string) => void;
    options: readonly string[];
    disabled?: boolean;
    className?: string;
    placeholder?: string;
    size?: "default" | "sm" | "xs";
    centered?: boolean;
}) {
    const { localValue, handleValueChange } = useOptimizedSelect(value, onChange);

    return (
        <div
            className={cn(
                "flex items-center group h-8 border border-input rounded-md transition-shadow relative bg-background min-w-0",
                !disabled ? "bg-white" : "bg-accent/50",
                disabled && UI_CONFIG.noBorderOnDisabled ? "border-none" : "",
                "focus-within:border-ring ring-0 outline-none",
                className
            )}
        >
            <div className="flex-1 flex items-center justify-center relative min-w-0 h-full">
                <Select
                    value={localValue}
                    onValueChange={handleValueChange}
                    disabled={disabled}
                    onOpenChange={(open) => {
                        if (!open) {
                            setTimeout(() => {
                                if (document.activeElement instanceof HTMLElement && 
                                    document.activeElement.getAttribute('data-slot') === 'select-trigger') {
                                    document.activeElement.blur();
                                }
                            }, 0);
                        }
                    }}
                >
                    <SelectTrigger
                        className="border-none focus:ring-0 focus:ring-offset-0 h-full w-full bg-transparent shadow-none px-0"
                        size="sm"
                        centered={centered}
                    >
                        <SelectValue placeholder={placeholder} />
                    </SelectTrigger>
                    <SelectContent className="min-w-16 w-fit">
                        {options.map((opt) => (
                            <SelectItem key={opt} value={opt} className={cn(centered && "justify-center")}>
                                {opt}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
});

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
    onBlurOverride?: () => void,
    onInput?: (val: string) => void
) {
    const inputRef = useRef<T>(null);
    const lastSentValueRef = useRef(value);
    const localValueRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const onBlurOverrideRef = useRef(onBlurOverride);
    const onInputRef = useRef(onInput);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        onBlurOverrideRef.current = onBlurOverride;
    }, [onBlurOverride]);

    useEffect(() => {
        onInputRef.current = onInput;
    }, [onInput]);

    // Sync with prop if it changes externally
    useEffect(() => {
        const normalizedProp = value?.toString().trim() || "";
        const normalizedLocal = localValueRef.current?.toString().trim() || "";

        if (normalizedProp !== normalizedLocal) {
            localValueRef.current = value;
        }

        if (inputRef.current) {
            const normalizedDOM = inputRef.current.value?.toString().trim() || "";
            
            if (normalizedProp !== normalizedDOM) {
                // Special case for numbers: don't overwrite "1." with "1" if they are numerically identical.
                // This prevents the dot from disappearing while the user is typing a decimal.
                const propNum = parseFloat(normalizedProp);
                const domNum = parseFloat(normalizedDOM);
                
                if (!isNaN(propNum) && !isNaN(domNum) && propNum === domNum) {
                    if (normalizedDOM.includes('.') && !normalizedProp.includes('.')) {
                        return;
                    }
                }

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
    }, [value]);

    useEffect(() => {
        let timer: NodeJS.Timeout;

        const handleSync = () => {
            // IMPORTANT: If inputRef.current is null (unmounting), fallback to localValueRef
            const currentVal = inputRef.current ? inputRef.current.value : localValueRef.current;

            if (currentVal !== lastSentValueRef.current) {
                if (typeof onChangeRef.current === 'function') {
                    // Use flushSync to ensure the parent state update is processed immediately
                    flushSync(() => {
                        onChangeRef.current!(currentVal);
                    });
                }
                lastSentValueRef.current = currentVal;
            }
            inputSyncManager.unregister(handleSync);
        };

        const onInputInternal = (e: Event) => {
            const target = e.target as T;
            let val = target.value;

            localValueRef.current = val;

            // Call the immediate onInput if provided
            if (onInputRef.current) {
                onInputRef.current(val);
            }

            inputSyncManager.register(handleSync);
            if (timer) clearTimeout(timer);
            timer = setTimeout(handleSync, debounceMs);
        };

        const element = inputRef.current;
        if (element) {
            element.addEventListener('input', onInputInternal);
            element.addEventListener('blur', () => {
                const target = inputRef.current;
                if (!target) return;

                let val = target.value;

                // Enforce min/max on blur
                if (target instanceof HTMLInputElement) {
                    const currentVal = parseFloat(val);
                    if (!isNaN(currentVal)) {
                        const minAttr = target.getAttribute("min");
                        if (minAttr !== null && minAttr !== "") {
                            const minVal = parseFloat(minAttr);
                            if (!isNaN(minVal) && currentVal < minVal) {
                                val = minAttr;
                                target.value = val;
                            }
                        }

                        const maxAttr = target.getAttribute("max");
                        if (maxAttr !== null && maxAttr !== "") {
                            const maxVal = parseFloat(maxAttr);
                            if (!isNaN(maxVal) && currentVal > maxVal) {
                                val = maxAttr;
                                target.value = val;
                            }
                        }
                    }
                }

                localValueRef.current = val;
                handleSync();
                if (onBlurOverrideRef.current) onBlurOverrideRef.current();
            });
        }

        return () => {
            if (element) {
                element.removeEventListener('input', onInputInternal);
            }
            if (timer) clearTimeout(timer);
            // Only call handleSync on unmount if we have a pending update
            if (localValueRef.current !== lastSentValueRef.current) {
                handleSync();
            }
        };
    }, [debounceMs]);

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
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

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
        if (typeof onChangeRef.current === 'function' && val !== lastPropValueRef.current) {
            flushSync(() => {
                onChangeRef.current!(val);
            });
            lastPropValueRef.current = val;
        }
        inputSyncManager.unregister(handleSync);
    }, []);

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

interface FastInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'onInput'> {
    value: string;
    onChange?: (value: string) => void;
    onInput?: (value: string) => void;
    debounceMs?: number;
    suffix?: string;
    prefix?: string;
    center?: boolean;
}

export const FastInput = memo(function FastInput({
    value,
    onChange,
    onInput,
    debounceMs = 1500,
    suffix,
    showPlus,
    prefix,
    center,
    ...props
}: FastInputProps) {
    const { inputRef } = useOptimizedInput<HTMLInputElement>(value, onChange, debounceMs, undefined, onInput);
    return <Input {...props} ref={inputRef} defaultValue={value} suffix={suffix} showPlus={showPlus} prefix={prefix} center={center} />;
});

interface FastTextareaProps extends Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange' | 'onInput'> {
    value: string;
    onChange?: (value: string) => void;
    onInput?: (value: string) => void;
    debounceMs?: number;
    label?: string; // Used for the dialog title
    showMaximize?: boolean;
    isSecret?: boolean;
}

export const FastTextarea = memo(function FastTextarea({
    value,
    onChange,
    onInput,
    debounceMs = 2000,
    label,
    showMaximize = false,
    isSecret = false,
    className,
    ...props
}: FastTextareaProps) {
    const mirrorRef = useRef<HTMLDivElement>(null);
    const { inputRef: textareaRef } = useOptimizedInput<HTMLTextAreaElement>(value, onChange, debounceMs, undefined, onInput);
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
                    "col-start-1 row-start-1 bg-transparent invisible whitespace-pre-wrap break-words min-h-[40px] px-2 py-2 text-sm pointer-events-none border border-transparent",
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
                    "col-start-1 row-start-1 w-full max-w-full h-full min-h-[40px] px-2 py-2 text-sm resize-none overflow-hidden break-words bg-white",
                    !isSecret && "disabled:bg-accent/50",
                    "disabled:opacity-100 disabled:cursor-default",
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
    center?: boolean;
}


export const FastSelect = memo(function FastSelect({
    value,
    onChange,
    debounceMs = 1000,
    placeholder = "",
    options,
    triggerClassName,
    size = "default",
    center,
    ...props
}: FastSelectProps) {
    const { localValue, handleValueChange } = useOptimizedSelect(value, onChange, debounceMs);

    return (
        <Select 
            {...props} 
            value={localValue} 
            onValueChange={handleValueChange}
            onOpenChange={(open) => {
                if (!open) {
                    // Force blur on the active element if it's a select trigger to prevent persistent focus ring
                    setTimeout(() => {
                        if (document.activeElement instanceof HTMLElement && 
                            document.activeElement.getAttribute('data-slot') === 'select-trigger') {
                            document.activeElement.blur();
                        }
                    }, 0);
                }
            }}
        >
            <SelectTrigger disabled={props.disabled} size={size} className={triggerClassName} centered={center}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="min-w-16 w-fit justify-center items-center">
                {options.map((opt) => {
                    const val = typeof opt === 'string' ? opt : opt.value;
                    const label = typeof opt === 'string' ? opt : opt.label;
                    return (
                        <SelectItem key={val} value={val} className="justify-center">
                            {label}
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
});
