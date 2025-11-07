import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const Contact = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">Contact Us</h1>
        <p className="text-sm text-muted-foreground">Have questions or need help? Send us a message below or email us at <span className="font-mono">support@tittoos.cloud</span>.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs">Name</label>
            <Input placeholder="Your name" />
          </div>
          <div>
            <label className="text-xs">Email</label>
            <Input type="email" placeholder="you@example.com" />
          </div>
        </div>
        <div>
          <label className="text-xs">Message</label>
          <Textarea placeholder="Write your message..." className="min-h-[120px]" />
        </div>
        <Button className="w-full">Send</Button>
      </div>
    </div>
  );
};

export default Contact;