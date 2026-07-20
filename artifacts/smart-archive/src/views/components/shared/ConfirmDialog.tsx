import Modal from "./Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  danger = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-muted-foreground mb-6">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
            danger
              ? "bg-destructive text-destructive-foreground hover:bg-red-700"
              : "bg-primary text-primary-foreground hover:bg-blue-700"
          } disabled:opacity-50`}
        >
          {loading ? "جاري..." : confirmLabel}
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
        >
          {cancelLabel}
        </button>
      </div>
    </Modal>
  );
}
