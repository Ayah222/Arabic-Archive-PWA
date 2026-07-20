interface ProgressBarProps {
  value: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  color?: "blue" | "green" | "yellow" | "red";
}

const colorMap = {
  blue: "bg-primary",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
};

const heightMap = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

export default function ProgressBar({
  value,
  showLabel = false,
  size = "md",
  color = "blue",
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  const barColor =
    pct === 100 ? colorMap.green : pct >= 60 ? colorMap.blue : pct >= 30 ? colorMap.yellow : colorMap.red;

  return (
    <div className="w-full">
      <div className={`w-full bg-muted rounded-full overflow-hidden ${heightMap[size]}`}>
        <div
          className={`${barColor} ${heightMap[size]} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">التقدم</span>
          <span className="text-xs font-semibold text-foreground">{pct}%</span>
        </div>
      )}
    </div>
  );
}
