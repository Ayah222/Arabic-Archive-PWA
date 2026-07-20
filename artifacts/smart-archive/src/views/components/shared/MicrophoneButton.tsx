import { useState } from "react";
import { useVoice } from "../../../controllers/useVoice";
import Modal from "./Modal";

interface MicrophoneButtonProps {
  projectId?: string;
  onResult?: (message: string) => void;
}

export default function MicrophoneButton({ projectId, onResult }: MicrophoneButtonProps) {
  const { state, result, error, startRecording, stopRecording, submitText, reset } = useVoice(projectId);
  const [showModal, setShowModal] = useState(false);
  const [textInput, setTextInput] = useState("");

  const isRecording = state === "recording";
  const isProcessing = state === "processing";

  const handleMicClick = () => {
    if (state === "idle" || state === "done" || state === "error") {
      setShowModal(true);
      reset();
    } else if (isRecording) {
      stopRecording();
    }
  };

  const handleSubmitText = async () => {
    if (!textInput.trim()) return;
    const res = await submitText(textInput.trim());
    if (res && onResult) {
      onResult(res.message);
    }
    setTextInput("");
  };

  return (
    <>
      <button
        onClick={handleMicClick}
        className={`relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          isRecording
            ? "bg-red-500 text-white scale-110 pulse-ring"
            : isProcessing
            ? "bg-yellow-500 text-white animate-pulse"
            : "bg-primary text-primary-foreground hover:bg-blue-700 hover:scale-105"
        }`}
        title={isRecording ? "إيقاف التسجيل" : "بدء الأمر الصوتي"}
        aria-label="زر الميكروفون"
      >
        <span className="text-2xl">
          {isRecording ? "⏹" : isProcessing ? "⌛" : "🎤"}
        </span>
      </button>

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); reset(); }}
        title="الأمر الصوتي"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            يمكنك استخدام الميكروفون أو كتابة الأمر مباشرة. مثال: "ذكرني باجتماع الغد"، "ابحث عن مشروع"
          </p>

          {state === "idle" && (
            <div className="space-y-4">
              <button
                onClick={async () => {
                  await startRecording();
                }}
                className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-blue-700 transition-colors"
              >
                <span className="text-2xl">🎤</span>
                بدء التسجيل الصوتي
              </button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs text-muted-foreground">
                  <span className="bg-card px-2">أو اكتب الأمر</span>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitText()}
                  placeholder="اكتب أمرك هنا..."
                  className="flex-1 px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  dir="rtl"
                />
                <button
                  onClick={handleSubmitText}
                  disabled={!textInput.trim()}
                  className="px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  إرسال
                </button>
              </div>
            </div>
          )}

          {isRecording && (
            <div className="text-center space-y-4">
              <div className="text-red-500 animate-pulse text-lg font-semibold">🔴 جاري التسجيل...</div>
              <button
                onClick={stopRecording}
                className="w-full py-4 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors"
              >
                ⏹ إيقاف التسجيل
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="text-center py-8">
              <div className="text-4xl animate-spin">⌛</div>
              <p className="text-muted-foreground mt-2">جاري المعالجة...</p>
            </div>
          )}

          {state === "done" && result && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-600">✅</span>
                  <span className="font-semibold text-green-800">تم معالجة الأمر</span>
                </div>
                <p className="text-green-700 text-sm">{result.message}</p>
              </div>
              <button
                onClick={() => { reset(); setTextInput(""); }}
                className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-semibold hover:bg-muted transition-colors"
              >
                أمر جديد
              </button>
            </div>
          )}

          {state === "error" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-red-700 text-sm">{error ?? "حدث خطأ غير متوقع"}</p>
              </div>
              <button
                onClick={reset}
                className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-semibold hover:bg-muted transition-colors"
              >
                المحاولة مجدداً
              </button>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
