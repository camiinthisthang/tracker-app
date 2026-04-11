"use client";

import { cn } from "@/lib/utils";

interface FilterPillsProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function FilterPills({ options, value, onChange }: FilterPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-slate-800 text-white"
              : "bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
