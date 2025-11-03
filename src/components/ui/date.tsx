import * as React from "react";

import { Input } from "@/components/ui/input";

interface DateInputProps {
    name: string;
    value: string | undefined;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
    disabled?: boolean;
}

export function DateInput({ name, value, onChange, className, disabled }: DateInputProps) {
    return (
        <Input
            type="date"
            name={name}
            value={value || ""}
            onChange={onChange}
            disabled={disabled}
            dir="rtl"
            style={{ scrollbarWidth: "none" }}
            className={`h-9 text-sm ${disabled ? "bg-accent/50" : "bg-white"} disabled:opacity-100 disabled:cursor-default ${className || ""}`}
        />
    );
}
