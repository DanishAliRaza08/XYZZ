import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";

export const metadata: Metadata = { title: "Frequently asked questions" };


export default function Page() {
  return (
    <InfoPage title="Frequently asked questions" eyebrow="Help">
<h2>Do I need an account to order?</h2><p>No — you can check out as a guest. You'll receive an order number to track your order.</p>
<h2>Which payment methods do you accept?</h2><p>Visa, Mastercard and American Express, plus Apple Pay and Google Pay where your device supports them. Payments are processed securely by Stripe.</p>
<h2>Do you ship to the US?</h2><p>Yes. Switch your region to US in the header to see prices in US dollars. US orders may be subject to sales tax and import duties.</p>
<h2>How do I return something?</h2><p>See our <a href="/delivery-returns" style={{ textDecoration: "underline" }}>delivery & returns</a> page. Returns are free within 28 days of delivery.</p>
<h2>How do I find the right size?</h2><p>Use our <a href="/size-guide" style={{ textDecoration: "underline" }}>size guide</a>, or ask in the chat.</p>
<h2>Can I speak to a person?</h2><p>Yes — open the chat and tap “Talk to a person”. You can continue on WhatsApp or wait for a reply in the chat.</p>
    </InfoPage>
  );
}
