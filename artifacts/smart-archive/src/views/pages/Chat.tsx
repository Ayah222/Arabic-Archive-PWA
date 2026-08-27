import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { getCurrentUser } from "../../controllers/useGlobal";

type Contact = { id: string; name: string; email: string | null };
type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
};

const API = "/api/sa/messages";

export default function Chat() {
  const currentUser = getCurrentUser();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadContacts = useCallback(async () => {
    const response = await fetch(`${API}/contacts`);
    if (!response.ok) throw new Error("تعذر تحميل المستخدمين");
    const data = (await response.json()) as Contact[];
    setContacts(data);
    setSelectedId((current) => current || data[0]?.id || "");
  }, []);

  const loadMessages = useCallback(async () => {
    if (!selectedId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const response = await fetch(`${API}?with=${encodeURIComponent(selectedId)}`);
    if (!response.ok) throw new Error("تعذر تحميل الرسائل");
    setMessages(await response.json());
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    loadContacts().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "حدث خطأ");
      setLoading(false);
    });
  }, [loadContacts]);

  useEffect(() => {
    loadMessages().catch((e: unknown) => setError(e instanceof Error ? e.message : "حدث خطأ"));
    const timer = window.setInterval(() => loadMessages().catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !selectedId || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: selectedId, message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر إرسال الرسالة");
      setMessages((current) => [...current, data]);
      setDraft("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "تعذر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  };

  const selected = contacts.find((contact) => contact.id === selectedId);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-black text-foreground">الدردشة</h1>
        <p className="text-sm text-muted-foreground mt-1">رسائل مباشرة بين المستخدمين والمدير</p>
      </div>

      <div className="liquid-glass-card rounded-2xl overflow-hidden">
        {currentUser?.role === "admin" && contacts.length > 0 && (
          <div className="p-3 border-b border-border">
            <select
              value={selectedId}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setLoading(true);
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none"
            >
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="h-[min(55vh,480px)] overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-10">جاري تحميل الرسائل...</p>
          ) : !selected ? (
            <div className="text-center py-14 text-muted-foreground">
              <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا يوجد مستخدمون متاحون للدردشة</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">ابدأ المحادثة مع {selected.name}</p>
            </div>
          ) : (
            messages.map((item) => {
              const mine = item.sender_id === currentUser?.id;
              return (
                <div key={item.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-secondary-foreground rounded-bl-sm"}`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{item.message}</p>
                    <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {new Date(item.created_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {selected && (
          <form onSubmit={sendMessage} className="p-3 border-t border-border flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="اكتب رسالتك..."
              maxLength={2000}
              className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="rounded-xl bg-primary text-primary-foreground px-4 disabled:opacity-50"
              aria-label="إرسال"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}