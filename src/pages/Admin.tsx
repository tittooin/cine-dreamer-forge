import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Admin = () => {
  const [userId, setUserId] = useState("");
  const [limit, setLimit] = useState("100");
  const [busy, setBusy] = useState(false);

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
        <p className="text-xs text-muted-foreground">Note: This page is hidden and only accessible via direct URL.</p>
      </div>
    </div>
  );
};

export default Admin;