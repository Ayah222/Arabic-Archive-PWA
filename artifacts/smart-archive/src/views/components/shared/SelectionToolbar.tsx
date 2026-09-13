interface SelectionToolbarProps {
  total: number;
  selected: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onClear: () => void;
  onDelete: () => void;
  deleting?: boolean;
}

export default function SelectionToolbar({
  total,
  selected,
  allSelected,
  onToggleAll,
  onClear,
  onDelete,
  deleting = false,
}: SelectionToolbarProps) {
  if (!total) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs">
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={allSelected} onChange={onToggleAll} className="accent-primary" />
        تحديد الكل
      </label>
      {selected > 0 && (
        <>
          <span className="text-muted-foreground">تم تحديد {selected}</span>
          <button type="button" onClick={onClear} className="text-muted-foreground hover:text-foreground">إلغاء التحديد</button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-lg bg-destructive px-3 py-1.5 font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? "جاري الحذف..." : "حذف المحدد"}
          </button>
        </>
      )}
    </div>
  );
}