import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";

export const metadata: Metadata = { title: "Terms & conditions" };


export default function Page() {
  return (
    <InfoPage title="Terms & conditions" eyebrow="Legal" draft>
<p>These terms apply to orders placed with Fashion Rockstar LTD through this website.</p>
<h2>Orders</h2><p>Your order is an offer to buy. A contract is formed when we confirm dispatch. We may decline an order, for example if an item is unavailable or a pricing error has occurred, in which case we will refund you in full.</p>
<h2>Prices</h2><p>UK prices include VAT. US prices exclude sales tax and import duties. Delivery charges are shown at checkout.</p>
<h2>Cancellations and returns</h2><p>See our <a href="/delivery-returns" style={{ textDecoration: "underline" }}>delivery & returns</a> page. Your statutory rights are not affected.</p>
<h2>Liability</h2><p>Nothing in these terms limits liability that cannot be limited by law.</p>
<h2>Governing law</h2><p>These terms are governed by the law of England and Wales.</p>
    </InfoPage>
  );
}
