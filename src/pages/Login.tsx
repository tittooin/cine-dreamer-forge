import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error(error.message); return; }
      toast.success(`Logged in as ${data.user?.email}`);
      const redirect = `${import.meta.env.BASE_URL}`; // send to home
      window.location.href = redirect;
    } catch (e: any) {
      toast.error(e?.message || "Login failed");
    } finally { setLoading(false); }
  };

  const handleSignup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { toast.error(error.message); return; }
      toast.success("Signup successful. Please verify email if required, then login.");
    } catch (e: any) {
      toast.error(e?.message || "Signup failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">{mode === "login" ? "Login" : "Create Test Account"}</h1>
        <div className="space-y-2">
          <label className="text-xs">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <label className="text-xs">Password</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Strong password" />
        </div>
        {mode === "login" ? (
          <Button className="w-full" disabled={loading} onClick={handleLogin}>{loading ? "Logging in..." : "Login"}</Button>
        ) : (
          <Button className="w-full" disabled={loading} onClick={handleSignup}>{loading ? "Creating..." : "Create Account"}</Button>
        )}
        <div className="text-xs text-muted-foreground text-center">
          {mode === "login" ? (
            <button className="underline" onClick={() => setMode("signup")}>Need a test account? Create one</button>
          ) : (
            <button className="underline" onClick={() => setMode("login")}>Already have an account? Login</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;