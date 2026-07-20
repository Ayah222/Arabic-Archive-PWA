interface StatusBadgeProps {
  label: string;
  colorClass: string;
  size?: "sm" | "md";
}

export default function StatusBadge({ label, colorClass, size = "sm" }: StatusBadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${colorClass}`}>
      {label}
    </span>
  );
}
