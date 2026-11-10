import { cn } from "@/lib/utils";

export function BrandMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <img src="/icon-192.png" alt="" width={40} height={40} className="size-10 rounded-md" />
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-lg font-semibold tracking-wide">Genario Souza</span>
          <span className="eyebrow text-[0.6rem]">Barbearia</span>
        </span>
      )}
    </span>
  );
}
