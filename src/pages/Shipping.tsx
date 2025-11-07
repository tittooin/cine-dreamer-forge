const Shipping = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">Shipping Policy</h1>
        <p className="text-sm text-muted-foreground">Digital product: images are delivered online immediately after generation. No physical shipping required.</p>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>Delivery: download links appear on the site after generation.</li>
          <li>Turnaround: typically under a minute, subject to compute availability.</li>
          <li>Support: if you cannot access your image, email support@tittoos.cloud.</li>
        </ul>
      </div>
    </div>
  );
};

export default Shipping;