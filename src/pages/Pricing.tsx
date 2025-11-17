import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Shield } from "lucide-react";
import { Link } from "react-router-dom";
import QRCode from "react-qr-code";

const Pricing = () => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
  const GPAY_VPA = import.meta.env.VITE_GPAY_VPA || "";
  const GPAY_NAME = import.meta.env.VITE_GPAY_NAME || "Tittoos Store";
  const GPAY_AMOUNTS = (import.meta.env.VITE_GPAY_AMOUNT || "2.99,11.99,49")
    .split(",")
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const [A1 = 2.99, A2 = 11.99, A3 = 49] = GPAY_AMOUNTS;

  const [upiIntent, setUpiIntent] = useState<string | null>(null);
  const [showUpiHelp, setShowUpiHelp] = useState(false);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [utrInput, setUtrInput] = useState("");

  const firstNameFromEmail = (email: string | null) => {
    if (!email) return null;
    try {
      const local = String(email).split('@')[0];
      const token = local.split(/[._\-+]/)[0];
      if (!token) return null;
      return token.charAt(0).toUpperCase() + token.slice(1);
    } catch { return null; }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setUserEmail(data.session?.user?.email ?? null);
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

  const handleSignInGoogle = async () => {
    const redirectTo = new URL('.', window.location.href).toString();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      toast.error("Google sign-in failed");
      console.error(error);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Sign out failed");
      console.error(error);
    } else {
      toast.success("Signed out");
    }
  };

  const createCashfreeOrder = async (amount: number, credits: number, note: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("create-cashfree-order", {
        body: { amount, credits, note },
      });
      if (error) {
        console.error("create-cashfree-order failed:", error);
        const detail = (error as any)?.context || (error as any)?.message || "Payment setup failed. Try again.";
        toast.error(String(detail));
        return null;
      }
      if (!data || !data.payment_id) {
        toast.error("Payment setup failed");
        return null;
      }
      setCurrentPaymentId(data.payment_id);
      const candidates = [
        (data.payment_link as string),
        (data.provider_link as string),
        (data.payments?.url as string),
        (data.payment_links?.link_url as string),
        (data.session?.url as string),
        (data.payment_session?.url as string),
        (data.url as string),
      ];
      const link = candidates.find((v) => typeof v === "string" && v.length > 0) || "";
      if (link) {
        return { link } as any;
      } else {
        const sessionId: string | undefined = (data.payment_session_id as string) || undefined;
        const env: string = (data.env as string) || "sandbox";
        if (sessionId) {
          return { sessionId, env } as any;
        }
      }
      return null;
    } catch (e: any) {
      console.error("create-cashfree-order exception:", e);
      toast.error(e?.message || "Payment setup failed. Try again.");
      return null;
    }
  };

  const creditsForAmount = (amt: number) => {
    if (Math.abs(amt - A1) < 0.01) return 1;
    if (Math.abs(amt - A2) < 0.01) return 5;
    if (Math.abs(amt - A3) < 0.01) return 50;
    return 1;
  };

  const startGPay = async (amount: number, note: string) => {
    if (!userEmail) { toast.error("Please login to purchase credits"); return; }
    const res = await createCashfreeOrder(amount, creditsForAmount(amount), note);
    if (res && (res as any).link) {
      const link = (res as any).link as string;
      try { window.open(link, "_blank"); } catch { window.location.href = link; }
      toast.success("Redirecting to payment gateway");
      return;
    }
    if (res && (res as any).sessionId) {
      const { sessionId, env } = res as any;
      try {
        await new Promise<void>((resolve, reject) => {
          if ((window as any).Cashfree) { resolve(); return; }
          const s = document.createElement("script");
          s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
          document.head.appendChild(s);
        });
        const cashfree = (window as any).Cashfree({ mode: env === "production" ? "production" : "sandbox" });
        await cashfree.checkout({ paymentSessionId: sessionId, redirectTarget: "_blank" });
        toast.success("Opening Cashfree checkout");
        return;
      } catch (e) {
        console.error("Cashfree SDK checkout failed:", e);
      }
    }
    toast.error("Unable to start payment");
  };

  const showGPayQR = async (amount: number, note: string) => {
    if (!userEmail) { toast.error("Please login to purchase credits"); return; }
    const { data, error } = await supabase.functions.invoke("create-upi-intent", {
      body: { amount, credits: creditsForAmount(amount), note },
    });
    if (error || !data?.upiUri || !data?.payment_id) { toast.error("UPI intent failed"); return; }
    setUpiIntent(data.upiUri);
    setCurrentPaymentId(data.payment_id);
    setShowUpiHelp(true);
    try { await navigator.clipboard.writeText(data.upiUri); toast.success("UPI link copied"); } catch {}
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Auth header */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {userEmail ? (
          <>
      <span className="text-sm text-muted-foreground">Logged in as {firstNameFromEmail(userEmail) || userEmail}</span>
            <Link to="/dashboard" className="inline-flex">
              <Button variant="outline" size="sm">Dashboard</Button>
            </Link>
            {ADMIN_EMAIL && userEmail.toLowerCase() === String(ADMIN_EMAIL).toLowerCase() && (
              <Link to="/admin-quiet-6b27c9" className="inline-flex">
                <Button variant="outline" size="sm">
                  <Shield className="mr-2 h-4 w-4" /> Admin
                </Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>Sign out</Button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSignInGoogle}>Continue with Google</Button>
            <a href={`${import.meta.env.BASE_URL}login`}>
              <Button variant="outline" size="sm">Login with Email</Button>
            </a>
          </div>
        )}
      </div>

      {/* Animated gradient background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-primary rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
        <div className="absolute top-0 -right-4 w-96 h-96 bg-accent rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-75" />
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-primary-glow rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-150" />
      </div>

      <div className="relative z-10 w-full max-w-4xl space-y-8">
        <Card className="p-6 border border-border rounded-2xl space-y-4 shadow-2xl bg-card">
          <h3 className="text-xl font-semibold">Pricing</h3>
          <p className="text-xs text-muted-foreground">Choose a bundle and pay via Google Pay (UPI).</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-border rounded-xl p-4 space-y-2">
              <h4 className="text-lg font-medium">Per Image</h4>
              <div className="text-2xl font-bold">₹{A1}</div>
              <p className="text-xs text-muted-foreground">1 credit for a single image</p>
              <div className="flex gap-2">
                <Button className="w-full" onClick={() => startGPay(A1, "Per Image (1 credit)")}>Buy</Button>
              </div>
            </div>
            <div className="border border-border rounded-xl p-4 space-y-2">
              <h4 className="text-lg font-medium">Bundle (5)</h4>
              <div className="text-2xl font-bold">₹{A2}</div>
              <p className="text-xs text-muted-foreground">5 credits — discounted</p>
              <div className="flex gap-2">
                <Button className="w-full" onClick={() => startGPay(A2, "Bundle (5 credits)")}>Buy</Button>
              </div>
            </div>
            <div className="border border-border rounded-xl p-4 space-y-2">
              <h4 className="text-lg font-medium">Monthly (50)</h4>
              <div className="text-2xl font-bold">₹{A3}</div>
              <p className="text-xs text-muted-foreground">50 credits per month</p>
              <div className="flex gap-2">
                <Button className="w-full" onClick={() => startGPay(A3, "Monthly (50 credits)")}>Buy</Button>
              </div>
            </div>
          </div>
          {showUpiHelp && upiIntent && (
            <div className="mt-4 p-3 border rounded-lg bg-muted/20">
              <div className="text-xs text-muted-foreground mb-2">Payment didn’t open. Scan the QR with Google Pay on mobile or copy the UPI link.</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div className="flex justify-center md:justify-start">
                  <div className="bg-white p-3 rounded-md border">
                    <QRCode value={upiIntent} size={140} />
                  </div>
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <Input readOnly value={upiIntent} className="text-[11px]" aria-label="UPI payment link" />
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(upiIntent); toast.success("UPI link copied"); }
                      catch { toast.error("Copy failed. Select and copy manually."); }
                    }}
                  >Copy</Button>
                  <a href={upiIntent} className="inline-flex">
                    <Button variant="default">Open in UPI app</Button>
                  </a>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">Payee: {GPAY_NAME} • VPA: {GPAY_VPA}</div>
              {currentPaymentId && (
                <div className="mt-3 flex items-center gap-2">
                  <Input
                    placeholder="Enter UPI Transaction ID (UTR)"
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    className="text-[12px]"
                    aria-label="UPI Transaction ID"
                  />
                  <Button
                    onClick={async () => {
                      const utr = utrInput.trim();
                      if (utr.length < 6) { toast.error("Please enter valid UTR"); return; }
                      if (!currentPaymentId) { toast.error("Payment not initialized"); return; }
                      try {
                        const { data, error } = await supabase.functions.invoke("confirm-upi-payment", {
                          body: { payment_id: currentPaymentId, utr },
                        });
                        if (error) { toast.error(error.message || "UTR confirmation failed"); return; }
                        if (data?.ok) { toast.success("Payment confirmed. Credits will reflect shortly."); setShowUpiHelp(false); setUpiIntent(null); }
                        else { toast.error("Unable to confirm UTR. Please contact support."); }
                      } catch (e) {
                        console.error(e);
                        toast.error("Confirmation failed. Try again.");
                      }
                    }}
                  >Confirm</Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Pricing;