import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = "info", onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const colorMap = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-primary",
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className={`${colorMap[type]} text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-sm`}>
        <span>{message}</span>
        <button onClick={onClose} className="opacity-80 hover:opacity-100 text-white text-lg leading-none">×</button>
      </div>
    </div>
  );
}
