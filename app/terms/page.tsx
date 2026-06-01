import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Helm (helmos.co).",
};

const EFFECTIVE_DATE = "May 30, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Back to helmos.co</Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">Terms of Service</h1>
        <p className="mt-2 text-xs text-zinc-500">Effective: {EFFECTIVE_DATE}</p>

        <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
          <strong>Draft notice.</strong> These Terms are an initial draft prepared by Helm&apos;s team for transparency to users. We&apos;re having them reviewed by counsel and will update this page before any material change. If anything below conflicts with applicable consumer-protection law, the law controls.
        </div>

        <Body>
          <H2>1. Who we are</H2>
          <P>
            Helm is a service offered by <strong>Sierra Sounds LLC, doing business as Helm</strong> (&ldquo;Sierra Sounds,&rdquo; &ldquo;Helm,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;). The Service includes the website at <Code>helmos.co</Code> and any related apps, APIs, or pages we host.
          </P>

          <H2>2. Your agreement to these Terms</H2>
          <P>
            By creating an account, paying for a subscription, or otherwise using Helm, you agree to these Terms of Service and our <Link href="/privacy" className="text-[#a5b4fc] hover:underline">Privacy Policy</Link>. If you don&apos;t agree, please don&apos;t use Helm.
          </P>

          <H2>3. Who can use Helm</H2>
          <P>
            You must be at least 18 years old, or the age of majority in your jurisdiction, to enter into a paid subscription on your own. By using Helm you confirm you have the legal authority to bind yourself (or the entity you represent) to these Terms.
          </P>

          <H2>4. Your account</H2>
          <P>
            You&apos;re responsible for keeping your login credentials secure. Don&apos;t share them. You&apos;re responsible for everything that happens under your account, including any outreach emails Helm sends on your behalf.
          </P>

          <H2>5. Subscription, billing, and cancellation</H2>
          <P>
            Helm is offered as a paid subscription. Pricing, included features, and any free-trial terms are shown at signup (currently <strong>$29 / month</strong>, billed in advance, with a 3-day free trial). By starting a trial or subscription, you authorize us (through our payment processor, Stripe) to charge your payment method on a recurring basis until you cancel.
          </P>
          <P>
            You can cancel any time from your account settings. Cancellation takes effect at the end of the current billing period; you keep access through that period. Except as required by law (or unless we say otherwise in writing), <strong>fees already paid are non-refundable</strong>. If you believe you&apos;ve been charged incorrectly, email <Email /> within 30 days and we&apos;ll work with you in good faith.
          </P>

          <H2>6. What you can and can&apos;t do with Helm</H2>
          <P>You agree NOT to:</P>
          <UL>
            <li>Use Helm to send spam, harassing, fraudulent, infringing, defamatory, or unlawful messages.</li>
            <li>Send outreach to anyone who has told you (or us) to stop contacting them.</li>
            <li>Misrepresent who you are or who you represent (impersonation).</li>
            <li>Use Helm to violate the CAN-SPAM Act, CASL, GDPR ePrivacy rules, or any equivalent law that applies to you.</li>
            <li>Reverse-engineer, scrape, or attempt to extract Helm&apos;s underlying databases or AI prompts.</li>
            <li>Use Helm to build a competing product (other than what&apos;s permitted by law).</li>
            <li>Resell or sublicense Helm without our written permission.</li>
          </UL>
          <P>
            We may suspend or terminate accounts that violate this section, including without notice for serious or repeated abuse.
          </P>

          <H2>7. Email sent on your behalf</H2>
          <P>
            Helm can send real emails from an address like <Code>yourartist@helmos.co</Code> on your behalf — to journalists, venues, curators, supervisors, and similar music-industry contacts. You acknowledge that:
          </P>
          <UL>
            <li>You authorize Helm to send these emails as your agent.</li>
            <li>You are the &ldquo;sender&rdquo; for legal purposes; you&apos;re responsible for content, accuracy, and compliance with applicable anti-spam law.</li>
            <li>You must honor opt-out requests and not contact people who&apos;ve previously asked to be left alone.</li>
            <li>Helm will refuse to send to addresses that fail deliverability verification, and we may rate-limit or block sends we believe are abusive.</li>
          </UL>

          <H2>8. AI-generated content</H2>
          <P>
            Helm uses large language models (currently from Anthropic) to draft bios, one-sheets, press releases, outreach emails, and similar content. AI output can be wrong, biased, outdated, or non-original. <strong>You are responsible for reviewing AI-generated content before you send, publish, or rely on it.</strong> We don&apos;t warrant that AI output is accurate, complete, lawful, or non-infringing.
          </P>

          <H2>9. Your content</H2>
          <P>
            You keep ownership of the content you upload or that Helm generates for you on your behalf (bios, one-sheets, etc.). You grant us a non-exclusive license to host, store, copy, display, and process that content as needed to operate and improve the Service. You represent that you have the rights necessary to use any third-party material you give us (e.g. song titles, artwork, press quotes).
          </P>

          <H2>10. Third-party services</H2>
          <P>
            Helm relies on third parties — currently including Anthropic (AI), Stripe (billing), Resend (email delivery), Spotify (artist data), Hunter.io (contact discovery and verification), Vercel (hosting), Upstash (data store), and our DNS provider. We&apos;re not responsible for outages or actions of those providers, though we&apos;ll do our reasonable best to keep things working.
          </P>

          <H2>11. Disclaimers</H2>
          <P>
            HELM IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE.&rdquo; TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT ANY OUTREACH WILL RESULT IN COVERAGE, PLACEMENT, BOOKINGS, OR OTHER BUSINESS OUTCOMES.
          </P>

          <H2>12. Limitation of liability</H2>
          <P>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, SIERRA SOUNDS&apos; TOTAL LIABILITY ARISING OUT OF OR RELATING TO THE SERVICE IS LIMITED TO THE AMOUNT YOU PAID US IN THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM. WE&apos;RE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, OR GOODWILL.
          </P>

          <H2>13. Indemnification</H2>
          <P>
            You agree to indemnify and hold Sierra Sounds and its officers, employees, and contractors harmless from any claim, loss, or expense (including reasonable attorneys&apos; fees) arising out of your use of the Service, your content, or your violation of these Terms or applicable law — including any claim that an outreach email you sent through Helm was unauthorized, false, or unlawful.
          </P>

          <H2>14. Termination</H2>
          <P>
            You can stop using Helm at any time by canceling. We can suspend or terminate your access for material breach of these Terms or for legal/safety reasons. On termination we&apos;ll, at your request and within a reasonable time, return your account data or confirm its deletion, except as we&apos;re required to retain it.
          </P>

          <H2>15. Changes to these Terms</H2>
          <P>
            We may update these Terms. If a change is material we&apos;ll give reasonable advance notice (email, dashboard banner, or both). Continued use of Helm after the effective date of an update means you accept the updated Terms.
          </P>

          <H2>16. Governing law and disputes</H2>
          <P>
            These Terms are governed by the laws of the State of <strong>California</strong>, USA, without regard to its conflict-of-laws rules. Any dispute will be resolved in the state or federal courts located in California, and you and we consent to the personal jurisdiction of those courts. Nothing in this section limits any non-waivable consumer rights you have under the laws of your home country or state.
          </P>

          <H2>17. Contact</H2>
          <P>
            Questions, complaints, or legal notices: <Email />.
          </P>
        </Body>

        <p className="mt-12 text-xs text-zinc-600 text-center">© 2026 Sierra Sounds LLC</p>
      </div>
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed">{children}</div>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-white mt-2">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-zinc-300">{children}</p>;
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-6 flex flex-col gap-1.5 text-zinc-300">{children}</ul>;
}
function Code({ children }: { children: React.ReactNode }) {
  return <code className="px-1.5 py-0.5 rounded bg-[#1a1a1a] text-zinc-200 text-xs font-mono">{children}</code>;
}
function Email() {
  return <a href="mailto:support@helmos.co" className="text-[#a5b4fc] hover:underline">support@helmos.co</a>;
}
