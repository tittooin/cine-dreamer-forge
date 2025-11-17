import React, { useState } from 'react';
import { useAuth } from '../cloud/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { open: boolean; onClose: () => void };

const LoginModal: React.FC<Props> = ({ open, onClose }) => {
  const { loginWithPassword, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    setLoading(true); setError(null);
    try { await loginWithPassword(email, password); onClose(); } catch (e: any) { setError(e?.message ?? 'Login failed'); }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v)=>{ if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Login to Tittoos Cloud</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <div className="text-sm text-destructive">{error}</div>}
          <Input placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
          <Button className="w-full" onClick={onLogin} disabled={loading}>{loading ? 'Logging in…' : 'Login'}</Button>
          <Button className="w-full" variant="outline" onClick={()=>loginWithGoogle()}>Continue with Google</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;