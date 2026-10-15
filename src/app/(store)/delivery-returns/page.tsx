import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Delivery & returns" };
export const dynamic = "force-dynamic";

export default async function Page() {
const s = (await getSettings()).shipping;
  return (
    <InfoPage title="Delivery & returns" eyebrow="Help" draft>
<h2>UK delivery</h2>
<ul>
  <li>Standard delivery (3–5 working days): {formatMoney(s.GBP.standard, "GBP")}, free on orders over {formatMoney(s.GBP.freeOver, "GBP")}.</li>
  <li>Express delivery (1–2 working days): {formatMoney(s.GBP.express, "GBP")}.</li>
</ul>
<h2>US delivery</h2>
<ul>
  <li>Standard delivery: {formatMoney(s.USD.standard, "USD")}, free on orders over {formatMoney(s.USD.freeOver, "USD")}.</li>
  <li>Express delivery: {formatMoney(s.USD.express, "USD")}.</li>
  <li>US orders may be subject to sales tax and import duties, payable by the recipient where applicable.</li>
</ul>
<p>Delivery times are estimates from dispatch and are not guaranteed. You'll receive tracking details when your order ships.</p>
<h2>Returns</h2>
<p>You can return unworn, unwashed items with their original tags within 28 days of delivery for a full refund to your original payment method.</p>
<h2>Your right to cancel</h2>
<p>Under the Consumer Contracts Regulations you may cancel your order within 14 days of receiving your goods without giving a reason. We will refund you within 14 days of receiving the goods back (or evidence that you have returned them), including the standard delivery charge.</p>
<h2>Faulty items</h2>
<p>If an item is faulty, please contact us — your statutory rights under the Consumer Rights Act 2015 are not affected.</p>
<h2>How to return</h2>
<p>Contact us via the chat or by email with your order number and we'll send return instructions.</p>
    </InfoPage>
  );
}
