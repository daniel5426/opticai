import React from "react";
import { IconArrowsExchange, IconRefresh } from "@tabler/icons-react";
import { cn } from "@/utils/tailwind";

interface CylTitleProps {
    onTranspose?: () => void;
    className?: string;
    disabled?: boolean;
}

export function CylTitle({ onTranspose, className, disabled }: CylTitleProps) {
    return (
        <div className={cn("flex items-center justify-center gap-1 group/cyl h-4", className)}>
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                CYL
            </span>
            {onTranspose && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onTranspose();
                    }}
                    disabled={disabled}
                    className={cn(
                        "p-0.5 rounded-sm hover:bg-accent text-muted-foreground/30 hover:text-primary transition-all flex items-center justify-center",
                        "opacity-0 group-hover/cyl:opacity-100", // Subtle: only shows on hover
                        disabled && "cursor-not-allowed opacity-0"
                    )}
                    title="Transpose Sign (Sph/Cyl/Ax)"
                >
                    <IconRefresh size={10} stroke={2.5} />
                </button>
            )}
        </div>
    );
}
