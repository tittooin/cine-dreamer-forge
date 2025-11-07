const Terms = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">Terms and Conditions</h1>
        <p className="text-sm text-muted-foreground">By using Tittoos AI, you agree to the following terms:</p>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>Generated content must comply with applicable laws and community standards.</li>
          <li>We may throttle or restrict usage in case of abuse or excessive load.</li>
          <li>Credits are non-refundable once consumed; trust-based UPI purchases are credited manually.</li>
          <li>Service is provided “as is”, without warranties. See Privacy and Refund policies for details.</li>
          <li>Contact support@tittoos.cloud for any disputes or clarifications.</li>
        </ul>
      </div>
    </div>
  );
};

export default Terms;