import * as React from "react";
import { useRef } from "react";

interface DateInputProps {
    name: string;
    value: string | undefined;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
    disabled?: boolean;
}

export function DateInput({ name, value, onChange, className, disabled }: DateInputProps) {
    const dateInputRef = useRef<HTMLInputElement>(null);

    const openDatePicker = () => {
        if (dateInputRef.current && !disabled) {
            dateInputRef.current.showPicker();
        }
    };

    return (
        <div className={`relative ${!disabled ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}>
            <div
                className={`text-sm text-right pr-10 h-8 rounded-md border px-3 py-2 border-input bg-transparent flex items-center ${disabled ? 'cursor-not-allowed bg-gray-100' : 'cursor-pointer'} ${className || ''}`}
                dir="rtl"
                onClick={openDatePicker}
            >
                {value ? new Date(value).toLocaleDateString('he-IL') : 'לחץ לבחירת תאריך'}
            </div>

            <input
                ref={dateInputRef}
                type="date"
                name={name}
                value={value || ''}
                onChange={onChange}
                disabled={disabled}
                className={`absolute opacity-0 h-0 w-0 overflow-hidden ${!disabled ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
            />

            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </div>
        </div>
    );
}
