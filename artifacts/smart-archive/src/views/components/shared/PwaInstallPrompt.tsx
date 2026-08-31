import { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(() =>
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  );

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) {
      setShowHelp(true);
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  };

  if (installed) return null;

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="md:hidden fixed right-4 bottom-4 z-[90] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-2xl"
        style={{ background: "linear-gradient(135deg, #00bcd4, #6d28d9)" }}
        aria-label="تثبيت التطبيق"
      >
        <Download className="w-4 h-4" />
        تثبيت التطبيق
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.72)" }} onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-primary" />
                <h3 className="font-bold">تثبيت التطبيق</h3>
              </div>
              <button type="button" onClick={() => setShowHelp(false)} aria-label="إغلاق">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              على iPhone افتح قائمة المشاركة في Safari ثم اختر «إضافة إلى الشاشة الرئيسية».
              وعلى Android افتح قائمة Chrome ثم اختر «تثبيت التطبيق».
            </p>
          </div>
        </div>
      )}
    </>
  );
}