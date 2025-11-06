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
  const [items, setItems] = useState<Array<{ user_id: string; email?: string; daily_limit: number; today_count: number; monthly_limit?: number }>>([]);
  const [monthlyLimit, setMonthlyLimit] = useState("100");
  const [monthlyDefault, setMonthlyDefault] = useState("100");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 10;
  // Registered users state
  const [regQuery, setRegQuery] = useState("");
  const [regPage, setRegPage] = useState(0);
  const [regUsers, setRegUsers] = useState<Array<{ id: string; email: string; created_at: string }>>([]);
  const [regPageSize, setRegPageSize] = useState(20);

  // Admin check helper
  const isAdminEmail = (email: string | null) => {
    if (!email || !ADMIN_EMAIL) return false;
    return email.toLowerCase() === String(ADMIN_EMAIL).toLowerCase();
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email ?? null;
      if (mounted) setUserEmail(email);
      // Only load admin lists if requester is admin
      if (isAdminEmail(email)) {
        await refreshList();
        await refreshRegistered();
      }
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? null;
      setUserEmail(email);
      // Refresh only for admin
      if (isAdminEmail(email)) {
        refreshList().catch(() => {});
      }
    });
    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

  const refreshList = async () => {
    // If not admin, do nothing (avoid non-2xx function errors)
    if (!isAdminEmail(userEmail)) return;
    try {
      const { data, error } = await supabase.functions.invoke("list-user-limits", {
        body: { page, pageSize, q: query }
      });
      if (error) throw error;
      if (data?.items) setItems(data.items);
    } catch (e) {
      console.error(e);
    }
  };
  const refreshRegistered = async () => {
    if (!isAdminEmail(userEmail)) return;
    try {
      const { data, error } = await supabase.functions.invoke("list-users", {
        body: { page: regPage, pageSize: regPageSize, q: regQuery },
      });
      if (error) throw error;
      if (data?.items) setRegUsers(data.items);
      else setRegUsers([]);
    } catch (e) {
      console.error("list-users error", e);
      toast.error("Failed to load registered users");
    }
  };

  const applyLimit = async () => {
    if (!isAdminEmail(userEmail)) {
      toast.error("Admin only");
      return;
    }
    if (!userId.trim()) {
      toast.error("Enter a valid userId");
      return;
    }
    const limitNum = Number(limit);
    const monthlyNum = Number(monthlyLimit);
    if (!Number.isFinite(limitNum) || limitNum <= 0) {
      toast.error("Enter a positive limit");
      return;
    }
    if (!Number.isFinite(monthlyNum) || monthlyNum <= 0) {
      toast.error("Enter a positive monthly limit");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("set-user-limit", {
        body: { userId: userId.trim(), dailyLimit: limitNum, monthlyLimit: monthlyNum },
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
        <div className="border rounded-xl p-3 bg-muted/20">
          <h3 className="text-sm font-medium">Global Defaults</h3>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className="text-xs">Daily Default</label>
              <Input placeholder="10" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </div>
            <div>
              <label className="text-xs">Monthly Default</label>
              <Input placeholder="100" value={monthlyDefault} onChange={(e) => setMonthlyDefault(e.target.value)} />
            </div>
          </div>
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!isAdminEmail(userEmail)) {
                  toast.error("Admin only");
                  return;
                }
                const dd = Number(limit);
                const md = Number(monthlyDefault);
                const { data, error } = await supabase.functions.invoke("set-default-limits", {
                  body: { dailyDefault: dd, monthlyDefault: md },
                });
                if (error || data?.error) {
                  toast.error("Failed to set defaults");
                } else {
                  toast.success("Defaults updated");
                }
              }}
            >
              Save Defaults
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm">User ID</label>
          <Input placeholder="supabase auth user id" value={userId} onChange={(e) => setUserId(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Daily Limit</label>
          <Input placeholder="e.g. 10" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Monthly Limit</label>
          <Input placeholder="e.g. 100" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} />
        </div>
        <Button onClick={applyLimit} disabled={busy} className="w-full">
          {busy ? "Saving..." : "Save Limit"}
        </Button>
        <div className="pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Current Limits</h3>
            <Button variant="outline" size="sm" onClick={refreshList}>Refresh</Button>
          </div>
          <div className="mt-2 flex gap-2">
            <Input placeholder="Search by email or user_id" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
          </div>
          <div className="mt-2 space-y-2">
            {items
              .filter((it) => {
                const q = query.trim().toLowerCase();
                if (!q) return true;
                return (
                  it.user_id.toLowerCase().includes(q) || (it.email ? it.email.toLowerCase().includes(q) : false)
                );
              })
              .slice(page * pageSize, page * pageSize + pageSize)
              .map((it) => (
              <div key={it.user_id} className="flex items-center justify-between border rounded-md p-2">
                <div>
                  <div className="text-sm font-mono">{it.user_id}</div>
                  <div className="text-xs text-muted-foreground">{it.email ?? "(no email)"}</div>
                  <div className="text-xs text-muted-foreground">Today: {it.today_count} / {it.daily_limit}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const newLimit = Math.max(1, (it.daily_limit ?? 1) - 1);
                      const { data, error } = await supabase.functions.invoke("set-user-limit", {
                        body: { userId: it.user_id, dailyLimit: newLimit },
                      });
                      if (error || data?.error) {
                        toast.error("Failed to update limit");
                      } else {
                        toast.success("Limit decreased");
                        await refreshList();
                      }
                    }}
                  >
                    -
                  </Button>
                  <div className="text-sm">Limit: {it.daily_limit}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const newLimit = (it.daily_limit ?? 0) + 1;
                      const { data, error } = await supabase.functions.invoke("set-user-limit", {
                        body: { userId: it.user_id, dailyLimit: newLimit },
                      });
                      if (error || data?.error) {
                        toast.error("Failed to update limit");
                      } else {
                        toast.success("Limit increased");
                        await refreshList();
                      }
                    }}
                  >
                    +
                  </Button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-sm text-muted-foreground">No limits set yet.</div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              disabled={page === 0}
            >
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {Math.max(1, Math.ceil(items.filter((it) => {
                const q = query.trim().toLowerCase();
                if (!q) return true;
                return (
                  it.user_id.toLowerCase().includes(q) || (it.email ? it.email.toLowerCase().includes(q) : false)
                );
              }).length / pageSize))}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => {
                const total = items.filter((it) => {
                  const q = query.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    it.user_id.toLowerCase().includes(q) || (it.email ? it.email.toLowerCase().includes(q) : false)
                  );
                }).length;
                const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
                return Math.min(p + 1, maxPage);
              })}
              disabled={(() => {
                const total = items.filter((it) => {
                  const q = query.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    it.user_id.toLowerCase().includes(q) || (it.email ? it.email.toLowerCase().includes(q) : false)
                  );
                }).length;
                const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
                return page >= maxPage;
              })()}
            >
              Next
            </Button>
          </div>
        </div>

        {/* Registered Users */}
        <div className="pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Registered Users</h3>
            <Button variant="outline" size="sm" onClick={refreshRegistered}>Refresh</Button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Input placeholder="Search by email or user_id" value={regQuery} onChange={(e) => { setRegQuery(e.target.value); setRegPage(0); }} />
            <Input type="number" placeholder="Page size" value={String(regPageSize)} onChange={(e) => setRegPageSize(Math.max(1, Number(e.target.value) || 20))} />
            <Button variant="outline" size="sm" onClick={refreshRegistered}>Load Registered Users</Button>
          </div>
          <div className="mt-2 space-y-2">
            {regUsers
              .filter((u) => {
                const q = regQuery.trim().toLowerCase();
                if (!q) return true;
                return (u.email ?? "").toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
              })
              .slice(regPage * pageSize, regPage * pageSize + pageSize)
              .map((u) => (
                <div key={u.id} className="flex items-center justify-between border rounded-md p-2">
                  <div>
                    <div className="text-sm font-mono">{u.id}</div>
                    <div className="text-xs text-muted-foreground">{u.email || "(no email)"}</div>
                    <div className="text-xs text-muted-foreground">Joined: {new Date(u.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            {regUsers.length === 0 && (
              <div className="text-sm text-muted-foreground">No registered users.</div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRegPage((p) => Math.max(p - 1, 0))}
              disabled={regPage === 0}
            >
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {regPage + 1} of {Math.max(1, Math.ceil(regUsers.filter((u) => {
                const q = regQuery.trim().toLowerCase();
                if (!q) return true;
                return (u.email ?? "").toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
              }).length / pageSize))}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRegPage((p) => {
                const total = regUsers.filter((u) => {
                  const q = regQuery.trim().toLowerCase();
                  if (!q) return true;
                return (u.email ?? "").toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
                }).length;
                const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
                return Math.min(p + 1, maxPage);
              })}
              disabled={(() => {
                const total = regUsers.filter((u) => {
                  const q = regQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (u.email ?? "").toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
                }).length;
                const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
                return regPage >= maxPage;
              })()}
            >
              Next
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Note: This page is hidden and only accessible via direct URL.</p>
      </div>
    </div>
  );
};

export default Admin;