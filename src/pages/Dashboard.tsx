import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type Usage = { free_remaining: number; paid_credits: number; remaining: number };
type PaymentItem = { payment_id: string; amount: number; credits: number; status: string; provider?: string; order_id?: string; provider_link?: string; created_at?: string };

const Dashboard = () => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (mounted) setUserEmail(user?.email ?? null);
      if (!user) { setLoading(false); return; }
      try {
        const { data: u } = await supabase.functions.invoke("usage-status");
        if (u && typeof u.remaining === "number") {
          setUsage({ free_remaining: u.free_remaining ?? 0, paid_credits: u.paid_credits ?? 0, remaining: u.remaining ?? 0 });
        }
      } catch (e) {
        console.error("usage-status", e);
        toast.error("Usage fetch failed");
      }
      try {
        const { data: p } = await supabase.functions.invoke("list-my-payments", { body: { page: 0, pageSize: 50 } });
        if (p && Array.isArray(p.items)) setItems(p.items);
      } catch (e) {
        console.error("list-my-payments", e);
      }
      setLoading(false);
    };
    init();
    return () => { mounted = false; };
  }, []);

  const confirmed = items.filter((i) => (i.status || "").toLowerCase() === "confirmed");
  const purchasedTotal = confirmed.reduce((sum, i) => sum + (Number(i.credits) || 0), 0);

  const refreshPayment = async (p: PaymentItem) => {
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-cashfree-order", { body: { payment_id: p.payment_id, order_id: p.order_id } });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Refresh failed");
      } else {
        toast.success("Payment reconciled");
        // Reload usage and payments
        const { data: u } = await supabase.functions.invoke("usage-status");
        if (u && typeof u.remaining === "number") setUsage({ free_remaining: u.free_remaining ?? 0, paid_credits: u.paid_credits ?? 0, remaining: u.remaining ?? 0 });
        const { data: p2 } = await supabase.functions.invoke("list-my-payments", { body: { page: 0, pageSize: 50 } });
        if (p2 && Array.isArray(p2.items)) setItems(p2.items);
      }
    } catch (e) {
      console.error("reconcile", e);
      toast.error("Refresh failed");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Your Credits</h1>
          <Link to="/">
            <Button variant="outline">Back</Button>
          </Link>
        </div>

        {userEmail ? (
          <div className="text-sm text-muted-foreground">Logged in as {userEmail}</div>
        ) : (
          <div className="text-sm">Please login to view your credits.</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Remaining Credits</div>
            <div className="text-3xl font-bold">{usage ? usage.remaining : (loading ? "…" : 0)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Free Credits Left</div>
            <div className="text-3xl font-bold">{usage ? usage.free_remaining : (loading ? "…" : 0)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Purchased Credits Available</div>
            <div className="text-3xl font-bold">{usage ? usage.paid_credits : (loading ? "…" : 0)}</div>
          </Card>
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-medium">Purchase History</h2>
            <div className="text-sm text-muted-foreground">Confirmed purchases: {purchasedTotal} credits</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Amount (₹)</th>
                  <th className="text-left py-2">Credits</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.payment_id} className="border-b">
                    <td className="py-2">{p.created_at ? new Date(p.created_at).toLocaleString() : "—"}</td>
                    <td className="py-2">{Number(p.amount).toFixed(2)}</td>
                    <td className="py-2">{p.credits}</td>
                    <td className="py-2">{p.status}</td>
                    <td className="py-2">
                      {(p.status || '').toLowerCase() === 'pending' ? (
                        <Button size="sm" variant="outline" onClick={() => refreshPayment(p)}>Refresh</Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td className="py-4 text-center text-muted-foreground" colSpan={4}>{loading ? "Loading…" : "No payments yet"}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;