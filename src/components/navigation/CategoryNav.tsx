import { cn } from "@/lib/cn";
import type { Category } from "@/lib/schemas/promotion";
import { ShoppingCart, Utensils, Fuel, Pill, Shirt, Plane, Cpu, Shapes } from "lucide-react";

const icons: Record<Category, React.ComponentType<{ className?: string }>> = {
  Supermarket: ShoppingCart,
  Fuel: Fuel,
  Dining: Utensils,
  Pharmacy: Pill,
  Electronics: Cpu,
  Fashion: Shirt,
  Travel: Plane,
  Other: Shapes
};

export function CategoryNav({
  categories,
  selected,
  onSelect
}: {
  categories: Category[];
  selected: Category | "All";
  onSelect: (c: Category | "All") => void;
}) {
  return (
    <nav aria-label="Categorías" className="w-full">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:items-stretch lg:overflow-visible lg:pb-0">
        <button
          type="button"
          onClick={() => onSelect("All")}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition lg:w-full",
            selected === "All"
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300"
          )}
        >
          <Shapes className="h-4 w-4" />
          <span>Todas</span>
        </button>

        {categories.map((c) => {
          const Icon = icons[c];
          const isSelected = selected === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onSelect(c)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition lg:w-full",
                isSelected
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{c}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

