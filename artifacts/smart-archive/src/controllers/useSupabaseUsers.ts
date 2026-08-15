import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { setCurrentUser } from "./useGlobal";

/* ─── Types ─── */
export interface SupabaseProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  invited_by: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  token: string;
  created_by: string | null;
  created_at: string;
  used: boolean;
}

/* ─── Employee Login (Supabase) ─── */
export async function supabaseLogin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  // Fetch profile
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileErr || !profile) throw new Error("تعذر تحميل بيانات الحساب");

  if (!profile.is_active) {
    await supabase.auth.signOut();
    throw new Error("FROZEN");
  }

  // Store in sessionStorage (same format as admin)
  const sessionUser = {
    id: profile.id,
    username: profile.email,
    name: profile.name ?? profile.email,
    role: profile.role,
    source: "supabase" as const,
  };
  setCurrentUser(sessionUser);
  return sessionUser;
}

/* ─── Fetch all Supabase profiles (admin) ─── */
export function useSupabaseProfiles() {
  return useQuery({
    queryKey: ["supabase-profiles"],
    queryFn: async (): Promise<SupabaseProfile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    retry: 1,
  });
}

/* ─── Fetch all invitations (admin) ─── */
export function useInvitations() {
  return useQuery({
    queryKey: ["invitations"],
    queryFn: async (): Promise<Invitation[]> => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    retry: 1,
  });
}

/* ─── Send Invite (simulated — stores token in DB, no real email) ─── */
export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, createdBy }: { email: string; createdBy: string }) => {
      // Check if already invited or registered
      const { data: existing } = await supabase
        .from("invitations")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existing) throw new Error("تم إرسال دعوة لهذا البريد مسبقاً");

      const token = crypto.randomUUID();
      const { error } = await supabase
        .from("invitations")
        .insert({ email, token, created_by: createdBy });
      if (error) throw new Error(error.message);

      return { email, token };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });
}

/* ─── Activate / Freeze account ─── */
export function useToggleActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supabase-profiles"] }),
  });
}

/* ─── Validate invitation token ─── */
export async function validateInviteToken(token: string): Promise<string | null> {
  const { data } = await supabase
    .from("invitations")
    .select("email, used")
    .eq("token", token)
    .maybeSingle();
  if (!data || data.used) return null;
  return data.email;
}

/* ─── Register employee (called from Register page) ─── */
export async function registerEmployee(
  token: string, name: string, password: string
): Promise<void> {
  // 1. Validate token
  const email = await validateInviteToken(token);
  if (!email) throw new Error("رابط الدعوة غير صالح أو منتهي الصلاحية");

  // 2. Sign up in Supabase Auth
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("فشل إنشاء الحساب");

  // 3. Create profile (frozen by default)
  const { error: profileErr } = await supabase
    .from("profiles")
    .insert({ id: data.user.id, email, name, role: "employee", is_active: false });
  if (profileErr) throw new Error(profileErr.message);

  // 4. Mark invitation as used
  await supabase.from("invitations").update({ used: true }).eq("token", token);

  // 5. Notify admin via API
  try {
    await fetch("/api/sa/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "موظف جديد بانتظار التفعيل",
        message: `${name} (${email}) أكمل التسجيل وينتظر تفعيل الحساب`,
        type: "info",
        priority: "high",
      }),
    });
  } catch { /* non-critical */ }
}
