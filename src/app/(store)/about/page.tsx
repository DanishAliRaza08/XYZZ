import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";

export const metadata: Metadata = { title: "About Fashion Rockstar" };


export default function Page() {
  return (
    <InfoPage title="About Fashion Rockstar" eyebrow="Our story">
<p>Fashion Rockstar LTD designs considered clothing for women and children — occasionwear for the moments that matter, and everyday pieces made to be worn and loved.</p>
<p>We believe in honest product information, fair prices and service from real people. Every product page tells you what we know about fabric, care and origin, and our team is a chat away.</p>
    </InfoPage>
  );
}
