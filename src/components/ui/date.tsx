import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface DateInputProps {
  name: string;
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
}

export function DateInput({
  name,
  value,
  onChange,
  className,
  disabled = false,
}: DateInputProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [textValue, setTextValue] = React.useState<string>("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const formatDateToString = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  React.useEffect(() => {
    if (value) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          setTextValue(formatDateToString(date));
        } else {
          setTextValue("");
        }
      } catch {
        setTextValue("");
      }
    } else {
      setTextValue("");
    }
  }, [value]);

  const parseDateFromText = (text: string): { date: Date; isoString: string } | null => {
    if (!text.trim()) return null;

    const trimmed = text.trim();

    const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
    if (isoMatch) {
      const date = new Date(trimmed + "T00:00:00");
      if (!isNaN(date.getTime())) {
        const [y, m, d] = trimmed.split("-").map(Number);
        return {
          date: new Date(y, m - 1, d),
          isoString: trimmed,
        };
      }
    }

    const parts = trimmed.split(/[\/\-\.]/);
    if (parts.length === 3) {
      let day: number, month: number, year: number;

      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }

      if (year < 100) {
        year += 2000;
      }

      if (
        day >= 1 &&
        day <= 31 &&
        month >= 1 &&
        month <= 12 &&
        year >= 1900 &&
        year <= 2100
      ) {
        const date = new Date(year, month - 1, day);
        if (
          !isNaN(date.getTime()) &&
          date.getDate() === day &&
          date.getMonth() === month - 1
        ) {
          const isoString = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          return { date, isoString };
        }
      }
    }

    try {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const isoString = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        return { date, isoString };
      }
    } catch {
      return null;
    }

    return null;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setTextValue(newText);
  };

  const handleTextBlur = () => {
    const parsed = parseDateFromText(textValue);
    if (parsed) {
      const formattedString = formatDateToString(parsed.date);
      setTextValue(formattedString);
      const syntheticEvent = {
        target: {
          name,
          value: parsed.isoString,
        },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    } else {
      if (value) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            setTextValue(formatDateToString(date));
          } else {
            setTextValue("");
          }
        } catch {
          setTextValue("");
        }
      } else {
        setTextValue("");
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const isoString = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
      const syntheticEvent = {
        target: {
          name,
          value: isoString,
        },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
      setIsOpen(false);
    }
  };

  const selectedDate = value
    ? (() => {
        try {
          const date = new Date(value);
          return !isNaN(date.getTime()) ? date : undefined;
        } catch {
          return undefined;
        }
      })()
    : undefined;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          name={name}
          value={textValue}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          disabled={disabled}
          dir="rtl"
          style={{ scrollbarWidth: "none" }}
          className={`h-9 pr-10 text-sm ${disabled ? "bg-accent/50" : "bg-white"} disabled:cursor-default disabled:opacity-100 ${className || ""}`}
          placeholder=""
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="pointer-events-auto absolute top-1/2 right-3 -translate-y-1/2 transform disabled:pointer-events-none disabled:opacity-50"
          >
            <svg
              className="text-muted-foreground h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            initialFocus
          />
        </PopoverContent>
      </div>
    </Popover>
  );
}
