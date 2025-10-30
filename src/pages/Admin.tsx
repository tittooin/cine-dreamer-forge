import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Admin = () => {
  const [userId, setUserId] = useState("");
  const [limit, setLimit] = useState("100");
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
  const [items, setItems] = useState<Array<{ user_id: string; daily_limit: number; today_count: number }>>([]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setUserEmail(data.session?.user?.email ?? null);
      await refreshList();
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

  const refreshList = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("list-user-limits");
      if (error) throw error;
      if (data?.items) setItems(data.items);
    } catch (e) {
      console.error(e);
    }
  };

  const applyLimit = async () => {
    if (!userId.trim()) {
      toast.error("Enter a valid userId");
      return;
    }
    const limitNum = Number(limit);
    if (!Number.isFinite(limitNum) || limitNum <= 0) {
      toast.error("Enter a positive limit");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("set-user-limit", {
        body: { userId: userId.trim(), dailyLimit: limitNum },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success(`Limit set: ${data.dailyLimit} for ${data.userId}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to set limit");
    } finally {
      setBusy(false);
    }
  };

  // Client-side gate: show 403 if not admin
  if (!userEmail || !ADMIN_EMAIL || userEmail.toLowerCase() !== String(ADMIN_EMAIL).toLowerCase()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-card border border-border rounded-xl p-6 space-y-2 text-center">
          <h2 className="text-xl font-semibold">403: Admin Only</h2>
          <p className="text-sm text-muted-foreground">Please login with admin email to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-xl font-semibold">Admin: Per-user Daily Limit</h2>
        <div className="space-y-2">
          <label className="text-sm">User ID</label>
          <Input placeholder="supabase auth user id" value={userId} onChange={(e) => setUserId(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Daily Limit</label>
          <Input placeholder="e.g. 100" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </div>
        <Button onClick={applyLimit} disabled={busy} className="w-full">
          {busy ? "Saving..." : "Save Limit"}
        </Button>
        <div className="pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Current Limits</h3>
            <Button variant="outline" size="sm" onClick={refreshList}>Refresh</Button>
          </div>
          <div className="mt-2 space-y-2">
            {items.map((it) => (
              <div key={it.user_id} className="flex items-center justify-between border rounded-md p-2">
                <div>
                  <div className="text-sm font-mono">{it.user_id}</div>
                  <div className="text-xs text-muted-foreground">Today: {it.today_count} / {it.daily_limit}</div>
                </div>
                <div className="text-sm">Limit: {it.daily_limit}</div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-sm text-muted-foreground">No limits set yet.</div>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Note: This page is hidden and only accessible via direct URL.</p>
      </div>
    </div>
  );
};

export default Admin;