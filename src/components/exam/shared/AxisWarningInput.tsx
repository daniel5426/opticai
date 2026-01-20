import React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/tailwind";

interface AxisWarningInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "onInput"> {
    eye: "R" | "L";
    field: "cyl" | "ax";
    missingAxis: boolean;
    missingCyl: boolean;
    isEditing: boolean;
    onValueChange: (eye: "R" | "L", field: "cyl" | "ax", value: string) => void;
}

export const AxisWarningInput = React.memo(function AxisWarningInput({
    eye,
    field,
    missingAxis,
    missingCyl,
    isEditing,
    onValueChange,
    className,
    value,
    ...props
}: AxisWarningInputProps) {
    const showWarning = (field === "ax" && missingAxis) || (field === "cyl" && missingCyl);

    return (
        <div className="relative">
            <Input
                {...(() => {
                    const { defaultValue: _, ...rest } = props as any;
                    return rest;
                })()}
                type="number"
                value={value}
                onChange={(e) => onValueChange(eye, field, e.target.value)}
                onInput={(e) => onValueChange(eye, field, e.currentTarget.value)}
                disabled={!isEditing}
                className={cn(
                    "h-8 text-xs disabled:opacity-100 disabled:cursor-default",
                    showWarning && "border-destructive ring-1 ring-destructive",
                    className
                )}
            />
            {showWarning && (
                <div dir="rtl" className="absolute -top-6 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-[10px] px-1 rounded shadow-sm whitespace-nowrap z-10 animate-in fade-in zoom-in duration-200">
                    {field === "ax" ? "חסר Axis" : "חסר Cyl"}
                </div>
            )}
        </div>
    );
});
