import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";

export const metadata: Metadata = { title: "Cookie policy" };


export default function Page() {
  return (
    <InfoPage title="Cookie policy" eyebrow="Legal" draft>
<p>We use only the cookies and browser storage needed to run the shop:</p>
<ul>
<li><strong>fr_currency</strong> — remembers your shopping region (UK or US).</li>
<li><strong>fr_admin</strong> — keeps staff signed in to the admin area.</li>
<li><strong>Local storage</strong> — stores your bag, wishlist, chat session and light/dark theme on your device.</li>
</ul>
<p>We don't currently use advertising or analytics cookies. If we add them, we'll ask for your consent first.</p>
    </InfoPage>
  );
}
