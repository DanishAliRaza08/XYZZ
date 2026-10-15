import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";

export const metadata: Metadata = { title: "Privacy policy" };


export default function Page() {
  return (
    <InfoPage title="Privacy policy" eyebrow="Legal" draft>
<p>This policy explains how Fashion Rockstar LTD (“we”) collects and uses personal data under the UK GDPR and the Data Protection Act 2018.</p>
<h2>What we collect</h2>
<ul><li>Order details: name, email, phone, delivery address, items purchased.</li><li>Chat conversations you have with our assistant or team, and any contact details you choose to give.</li><li>Newsletter subscriptions, with your consent.</li><li>Payment information is collected and processed by Stripe; we do not see or store card numbers.</li></ul>
<h2>Why we use it</h2>
<ul><li>To fulfil your order and provide customer service (contract).</li><li>To meet legal and tax obligations (legal obligation).</li><li>To send marketing emails, only where you have consented (consent).</li><li>To prevent fraud and keep the site secure (legitimate interests).</li></ul>
<h2>AI assistant</h2>
<p>Messages you send in the chat may be processed by our AI provider (Anthropic) to generate replies. Please don't share payment details in chat.</p>
<h2>Your rights</h2>
<p>You can request access to, correction or deletion of your personal data, object to processing, or withdraw consent at any time by contacting us. You may also complain to the Information Commissioner's Office (ico.org.uk).</p>
<h2>Retention</h2>
<p>Order records are kept for as long as required for accounting and tax purposes. Chat transcripts are kept for up to 12 months.</p>
    </InfoPage>
  );
}
