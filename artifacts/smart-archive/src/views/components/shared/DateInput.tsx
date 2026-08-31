import { useMemo } from "react";

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const pad = (value: number) => String(value).padStart(2, "0");

export default function DateInput({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [yearValue, monthValue, dayValue] = value.split("-").map(Number);
  const year = Number.isFinite(yearValue) && yearValue > 0 ? yearValue : 0;
  const month = Number.isFinite(monthValue) && monthValue > 0 ? monthValue : 0;
  const day = Number.isFinite(dayValue) && dayValue > 0 ? dayValue : 0;
  const years = useMemo(() => Array.from({ length: 151 }, (_, index) => 1950 + index), []);

  const update = (part: "day" | "month" | "year", nextValue: string) => {
    const next = {
      day,
      month,
      year,
      [part]: Number(nextValue),
    };
    if (!next.day || !next.month || !next.year) {
      onChange("");
      return;
    }
    const maxDay = new Date(next.year, next.month, 0).getDate();
    onChange(`${next.year}-${pad(next.month)}-${pad(Math.min(next.day, maxDay))}`);
  };

  const selectClass = `w-full px-3 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm ${className}`;

  return (
    <div className="grid grid-cols-3 gap-2" dir="rtl">
      <label className="text-xs text-muted-foreground">
        اليوم
        <select value={day || ""} onChange={(event) => update("day", event.target.value)} className={selectClass}>
          <option value="" disabled>اليوم</option>
          {Array.from({ length: 31 }, (_, index) => index + 1).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">
        الشهر
        <select value={month || ""} onChange={(event) => update("month", event.target.value)} className={selectClass}>
          <option value="" disabled>الشهر</option>
          {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">
        السنة
        <select value={year || ""} onChange={(event) => update("year", event.target.value)} className={selectClass}>
          <option value="" disabled>السنة</option>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
    </div>
  );
}