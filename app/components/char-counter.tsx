import clsx from "clsx";

// "12 / 300" under a text field, orange once the limit is reached.
export function CharCounter({
  valueLength,
  maxLength,
  className,
}: {
  valueLength: number;
  maxLength: number;
  className?: string;
}) {
  const color = valueLength >= maxLength ? "text-orange-500" : "text-white/50";
  return (
    <div
      className={clsx(color, "text-sm", className)}
      data-testid="char-counter"
    >
      {valueLength} / {maxLength}
    </div>
  );
}
