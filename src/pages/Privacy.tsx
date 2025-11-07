const Privacy = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">We respect your privacy. This policy explains what data we collect, how we use it, and your rights.</p>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>Account data: email and basic profile from Google OAuth.</li>
          <li>Usage data: prompts count and limits to prevent abuse.</li>
          <li>Storage: generated images may be stored temporarily for delivery.</li>
          <li>Payments: UPI payment confirmations are handled trust-based; no card data is stored.</li>
          <li>Contact: support@tittoos.cloud for privacy inquiries.</li>
        </ul>
        <p className="text-xs text-muted-foreground">Effective date: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
};

export default Privacy;