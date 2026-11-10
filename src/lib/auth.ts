import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminStatus {
  email: string | null;
  isAdmin: boolean;
}

export const adminStatusQuery = queryOptions({
  queryKey: ["admin-status"],
  queryFn: async (): Promise<AdminStatus> => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return { email: null, isAdmin: false };
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { email: user.email ?? null, isAdmin: Boolean(data) };
  },
});

/** Keeps redirects on this site and inside the admin area. */
export function safeAdminRedirect(value: unknown): string {
  if (typeof value === "string" && value.startsWith("/admin") && !value.startsWith("//")) return value;
  return "/admin";
}
