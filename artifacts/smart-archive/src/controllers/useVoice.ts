import { useState, useRef, useCallback } from "react";
import { useProcessVoice } from "@workspace/api-client-react";
import type { VoiceResult } from "@workspace/api-client-react";

export type VoiceState = "idle" | "recording" | "processing" | "done" | "error";

export function useVoice(projectId?: string) {
  const [state, setState] = useState<VoiceState>("idle");
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const processVoice = useProcessVoice();

  const submitText = useCallback(
    async (text: string) => {
      setState("processing");
      try {
        const res = await processVoice.mutateAsync({
          data: { text, projectId: projectId ?? null },
        });
        setResult(res);
        setState("done");
        return res;
      } catch {
        setError("فشل في معالجة الأمر الصوتي");
        setState("error");
        return null;
      }
    },
    [processVoice, projectId]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("processing");
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        const OPENAI_KEY = (import.meta as { env: Record<string, string> }).env.VITE_OPENAI_API_KEY;
        if (OPENAI_KEY) {
          try {
            const form = new FormData();
            form.append("file", blob, "recording.webm");
            form.append("model", "whisper-1");
            form.append("language", "ar");
            const transcribeRes = await fetch(
              "https://api.openai.com/v1/audio/transcriptions",
              { method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}` }, body: form }
            );
            const transcribeData = (await transcribeRes.json()) as { text?: string };
            if (transcribeData.text) {
              await submitText(transcribeData.text);
              return;
            }
          } catch {
            /* fall through to stub */
          }
        }

        await submitText("أمر تجريبي - مفتاح OpenAI غير مضبوط");
      };
      mr.start();
      setState("recording");
    } catch {
      setError("لا يمكن الوصول إلى الميكروفون. تأكد من منح الإذن.");
      setState("error");
    }
  }, [submitText]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, [state]);

  const reset = useCallback(() => {
    setState("idle");
    setResult(null);
    setError(null);
  }, []);

  return { state, result, error, startRecording, stopRecording, submitText, reset };
}
