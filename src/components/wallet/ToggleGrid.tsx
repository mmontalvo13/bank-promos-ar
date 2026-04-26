import { cn } from "@/lib/cn";

export function ToggleGrid<T extends string>({
  items,
  selected,
  onToggle,
  getLabel
}: {
  items: readonly T[];
  selected: readonly T[];
  onToggle: (item: T) => void;
  getLabel?: (item: T) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => {
        const isSelected = selected.includes(item);
        return (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            className={cn(
              "rounded-2xl border px-3 py-3 text-left text-sm font-extrabold transition",
              isSelected
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300"
            )}
          >
            <div className="truncate">{getLabel ? getLabel(item) : item}</div>
            <div className={cn("mt-1 text-xs font-semibold", isSelected ? "text-white/80" : "text-neutral-600")}>
              {isSelected ? "En mi billetera" : "No lo tengo"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

