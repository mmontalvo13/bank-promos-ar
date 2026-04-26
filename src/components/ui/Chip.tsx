import { cn } from "@/lib/cn";

export function Chip({
  label,
  selected,
  onClick,
  className
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition",
        selected
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300",
        className
      )}
    >
      {label}
    </button>
  );
}

