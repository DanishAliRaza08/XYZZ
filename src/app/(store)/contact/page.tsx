import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";
import { getSettings, whatsappLink } from "@/lib/settings";

export const metadata: Metadata = { title: "Contact us" };
export const dynamic = "force-dynamic";

export default async function Page() {
const st = await getSettings();
const wa = whatsappLink(st.whatsappNumber, "Hello Fashion Rockstar, I have a question.");
  return (
    <InfoPage title="Contact us" eyebrow="Help">
<p>We're happy to help with sizing, orders, delivery and returns.</p>
<ul>
  <li><strong>Live chat:</strong> tap the chat button at the bottom of any page — our assistant answers instantly, and you can ask for a person at any time.</li>
  {wa && <li><strong>WhatsApp:</strong> <a href={wa} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>Message us on WhatsApp</a></li>}
  {st.supportPhone && <li><strong>Phone:</strong> <a href={`tel:${st.supportPhone}`}>{st.supportPhone}</a></li>}
  <li><strong>Email:</strong> <a href={`mailto:${st.supportEmail}`} style={{ textDecoration: "underline" }}>{st.supportEmail}</a></li>
  {st.companyAddress && <li><strong>Address:</strong> {st.companyAddress}</li>}
</ul>
    </InfoPage>
  );
}
