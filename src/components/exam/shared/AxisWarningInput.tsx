import React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/tailwind";

interface AxisWarningInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "onInput" | "onBlur"> {
    eye: "R" | "L";
    field: "cyl" | "ax";
    missingAxis: boolean;
    missingCyl: boolean;
    isEditing: boolean;
    onValueChange: (eye: "R" | "L", field: "cyl" | "ax", value: string) => void;
    onBlur?: (eye: "R" | "L", field: "cyl" | "ax", value: string) => void;
    onNativeBlur?: React.FocusEventHandler<HTMLInputElement>;
}

export const AxisWarningInput = React.memo(function AxisWarningInput({
    eye,
    field,
    missingAxis,
    missingCyl,
    isEditing,
    onValueChange,
    onBlur,
    onNativeBlur,
    className,
    value,
    ...props
}: AxisWarningInputProps) {
    const showWarning = (field === "ax" && missingAxis) || (field === "cyl" && missingCyl);
    const axisWarningMessage = showWarning ? (field === "ax" ? "חסר Axis" : "חסר Cyl") : null;
    const warningMessage = props.warningMessage ?? axisWarningMessage;
    const ariaInvalid = props["aria-invalid"] || showWarning ? true : undefined;

    return (
        <div className="relative">
            <Input
                {...(() => {
                    const {
                        defaultValue: _,
                        warningMessage: __,
                        "aria-invalid": ___,
                        ...rest
                    } = props as any;
                    return rest;
                })()}
                type="number"
                value={value}
                aria-invalid={ariaInvalid}
                warningMessage={warningMessage}
                onChange={(e) => onValueChange(eye, field, e.target.value)}
                onInput={(e) => onValueChange(eye, field, e.currentTarget.value)}
                onBlur={(e) => {
                    onBlur?.(eye, field, e.target.value);
                    onNativeBlur?.(e);
                }}
                disabled={!isEditing}
                className={cn(
                    "h-8 text-xs disabled:opacity-100 disabled:cursor-default",
                    className
                )}
            />
        </div>
    );
});
