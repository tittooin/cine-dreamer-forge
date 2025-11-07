const Refunds = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">Cancellations and Refunds</h1>
        <p className="text-sm text-muted-foreground">Digital credits are added on payment. Refunds are available for mistaken charges within 7 days.</p>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>Request refunds via support@tittoos.cloud with payment reference.</li>
          <li>Consumed credits cannot be refunded.</li>
          <li>Fraud or abuse may lead to account limitation.</li>
        </ul>
      </div>
    </div>
  );
};

export default Refunds;