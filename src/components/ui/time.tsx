import * as React from "react";
import { Clock } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/utils/tailwind";

interface TimeInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "type" | "value" | "defaultValue" | "onChange"
  > {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const HOURS = Array.from({ length: 24 }, (_, index) =>
  index.toString().padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, index) =>
  index.toString().padStart(2, "0"),
);

function parseStrictTime(
  rawValue: string,
): { hours: string; minutes: string } | null {
  const match = rawValue.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;

  return { hours: match[1], minutes: match[2] };
}

function cleanTimeText(rawValue: string, previousValue: string): string {
  const cleaned = rawValue.replace(/[^\d:]/g, "");
  const [rawHours = "", rawMinutes = ""] = cleaned.split(":");
  const hours = rawHours.slice(0, 2);
  const minutes = rawMinutes.slice(0, 2);

  if (cleaned.includes(":")) {
    if (hours.length === 2 && Number(hours) > 23) return previousValue;
    if (minutes.length === 2 && Number(minutes) > 59) return previousValue;
    return `${hours}:${minutes}`;
  }

  const digits = cleaned.slice(0, 4);
  if (digits.length <= 2) return digits;

  const digitHours = digits.slice(0, 2);
  const digitMinutes = digits.slice(2);

  if (Number(digitHours) > 23) return previousValue;
  if (digitMinutes.length === 2 && Number(digitMinutes) > 59) {
    return previousValue;
  }

  return `${digitHours}:${digitMinutes}`;
}

function normalizeTime(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";

  const match = trimmed.match(/^(\d{1,2})(?::?(\d{1,2}))?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");

  if (hours > 23 || minutes > 59) return null;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

export function TimeInput({
  value,
  onChange,
  className,
  name,
  id,
  disabled,
  ...props
}: TimeInputProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [textValue, setTextValue] = React.useState(value ?? "");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setTextValue(value ?? "");
  }, [value]);

  const emitChange = (nextValue: string) => {
    if (!onChange) return;

    onChange({
      target: {
        id,
        name,
        value: nextValue,
      },
      currentTarget: {
        id,
        name,
        value: nextValue,
      },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  const applyTime = (nextValue: string) => {
    setTextValue(nextValue);
    emitChange(nextValue);
  };

  const selectedTime =
    parseStrictTime(textValue) ?? parseStrictTime(value ?? "");
  const selectedHour = selectedTime?.hours ?? "00";
  const selectedMinute = selectedTime?.minutes ?? "00";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <div className="relative">
        <Input
          {...props}
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          dir="ltr"
          center
          disabled={disabled}
          value={textValue}
          placeholder="HH:MM"
          className={cn("px-9 tabular-nums", className)}
          onChange={(e) => {
            const nextValue = cleanTimeText(e.target.value, textValue);
            setTextValue(nextValue);

            if (nextValue === "" || parseStrictTime(nextValue)) {
              emitChange(nextValue);
            }
          }}
          onBlur={(e) => {
            const normalizedValue = normalizeTime(textValue);

            if (normalizedValue !== null) {
              applyTime(normalizedValue);
            } else {
              setTextValue(value ?? "");
            }

            props.onBlur?.(e);
          }}
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 left-2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm disabled:pointer-events-none disabled:opacity-50"
            aria-label="Select time"
          >
            <Clock className="h-4 w-4" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-muted-foreground mb-1 text-center text-xs font-medium">
              HH
            </div>
            <ScrollArea className="h-48 rounded-md border">
              <div className="grid gap-1 p-1">
                {HOURS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    className={cn(
                      "hover:bg-accent hover:text-accent-foreground h-8 rounded-sm text-sm tabular-nums",
                      selectedHour === hour &&
                        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    )}
                    onClick={() => applyTime(`${hour}:${selectedMinute}`)}
                  >
                    {hour}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div>
            <div className="text-muted-foreground mb-1 text-center text-xs font-medium">
              MM
            </div>
            <ScrollArea className="h-48 rounded-md border">
              <div className="grid gap-1 p-1">
                {MINUTES.map((minute) => (
                  <button
                    key={minute}
                    type="button"
                    className={cn(
                      "hover:bg-accent hover:text-accent-foreground h-8 rounded-sm text-sm tabular-nums",
                      selectedMinute === minute &&
                        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    )}
                    onClick={() => applyTime(`${selectedHour}:${minute}`)}
                  >
                    {minute}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
