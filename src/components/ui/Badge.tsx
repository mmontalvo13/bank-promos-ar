import { cn } from "@/lib/cn";

export function Badge({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-xs font-medium text-neutral-800",
        className
      )}
    >
      {children}
    </span>
  );
}

