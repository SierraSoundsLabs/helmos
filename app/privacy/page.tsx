import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Helm (helmos.co) collects, uses, and protects your data.",
};

const EFFECTIVE_DATE = "May 30, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-200 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Back to helmos.co</Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-2 text-xs text-zinc-500">Effective: {EFFECTIVE_DATE}</p>

        <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
          <strong>Draft notice.</strong> This Policy is an initial draft we&apos;re publishing for transparency. We&apos;re having it reviewed by counsel, and we&apos;ll update this page before any material change.
        </div>

        <Body>
          <P>
            This Privacy Policy explains how <strong>Sierra Sounds LLC</strong> (&ldquo;Sierra Sounds,&rdquo; &ldquo;Helm,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;) collects, uses, and shares information when you use <Code>helmos.co</Code> and related services (the &ldquo;Service&rdquo;).
          </P>

          <H2>1. Information we collect</H2>
          <P><strong>You give us:</strong></P>
          <UL>
            <li><strong>Account info:</strong> your email address and password (stored hashed).</li>
            <li><strong>Your artist data:</strong> the Spotify artist URL/ID you connect, plus anything you tell Helm during onboarding (location, genre, story).</li>
            <li><strong>Content you create with Helm:</strong> bios, one-sheets, press releases, upcoming shows, social links, song-link entries, EPK details, outreach drafts, and chat messages.</li>
            <li><strong>Outreach activity:</strong> the contacts you reach out to (name, email, outlet), the pitches sent, and replies received at your <Code>yourartist@helmos.co</Code> alias.</li>
            <li><strong>Support messages</strong> you send us.</li>
          </UL>
          <P><strong>We get from third parties:</strong></P>
          <UL>
            <li><strong>Spotify Web API:</strong> public artist profile (name, image, top tracks, releases, monthly listeners) for the artist URL you connect.</li>
            <li><strong>Stripe:</strong> subscription status and limited billing metadata. We don&apos;t store full card numbers — Stripe handles that.</li>
            <li><strong>Hunter.io:</strong> publicly-available, business-contact information about journalists, venues, and similar professional contacts that Helm presents and verifies on your behalf.</li>
          </UL>
          <P><strong>We collect automatically:</strong></P>
          <UL>
            <li><strong>Usage data:</strong> pages visited, features used, approximate device/browser info, and similar product analytics (via Vercel Web Analytics — designed to be privacy-friendly and cookie-less).</li>
            <li><strong>Server logs:</strong> IP address, timestamps, and request details when our servers handle a request.</li>
            <li><strong>Session cookies:</strong> a single first-party cookie that keeps you logged in.</li>
          </UL>

          <H2>2. How we use information</H2>
          <UL>
            <li>To provide, secure, and improve Helm — including running AI features and sending outreach on your authorized behalf.</li>
            <li>To process payments and handle subscription lifecycle.</li>
            <li>To send transactional emails (password reset, billing receipts, inbound-mail notifications, support replies).</li>
            <li>To analyze aggregate usage so we can make the product better.</li>
            <li>To detect, prevent, and respond to abuse, fraud, and legal/safety risks.</li>
            <li>To comply with law and enforce our <Link href="/terms" className="text-[#a5b4fc] hover:underline">Terms of Service</Link>.</li>
          </UL>
          <P>
            <strong>We do not sell your personal information.</strong> We don&apos;t use your content to train third-party AI models, and we don&apos;t share it with advertisers.
          </P>

          <H2>3. Who we share with (subprocessors)</H2>
          <P>Helm runs on a small number of carefully chosen vendors. Each handles a specific job:</P>
          <UL>
            <li><strong>Anthropic</strong> — runs the AI models that draft bios, pitches, and so on. Per Anthropic&apos;s API terms, your inputs are not used to train their public models.</li>
            <li><strong>Stripe</strong> — payment processing.</li>
            <li><strong>Resend</strong> — sends and receives email from <Code>helmos.co</Code> (including outreach you authorize and replies routed back to your dashboard inbox).</li>
            <li><strong>Spotify</strong> — read-only access to public artist data.</li>
            <li><strong>Hunter.io</strong> — contact discovery and email-address verification.</li>
            <li><strong>Vercel</strong> — hosting and edge networking; also product analytics.</li>
            <li><strong>Upstash (Redis)</strong> — our primary data store for accounts and content.</li>
            <li><strong>GoDaddy</strong> — DNS for helmos.co.</li>
          </UL>
          <P>
            We may also share information when required by law, to comply with legal process, to protect users or the public, or in connection with a sale or transfer of our business (in which case the acquirer must honor this Policy).
          </P>

          <H2>4. International transfers</H2>
          <P>
            Our servers and subprocessors are based in the United States and other countries. If you&apos;re outside the U.S., your information will be transferred to and processed in the U.S. We rely on standard contractual clauses or equivalent safeguards where required.
          </P>

          <H2>5. How long we keep your information</H2>
          <P>
            We keep your account and content while your account is active. If you cancel, we keep limited information as needed for billing records, fraud prevention, or legal obligations (typically up to 7 years for tax/accounting). You can request earlier deletion (see Your Rights below); we&apos;ll honor it except where law requires retention.
          </P>

          <H2>6. Your rights</H2>
          <P>
            Depending on where you live, you may have the right to access, correct, export, delete, or restrict our use of your personal data — and to object to certain uses. To exercise any of these, email <Email />.
          </P>
          <P>
            We&apos;ll respond within 30 days. We don&apos;t charge for routine requests. We may need to verify your identity before acting on a request.
          </P>

          <H2>7. Security</H2>
          <P>
            We use industry-standard practices to protect your data — HTTPS everywhere, hashed passwords (PBKDF2), signed session cookies, environment-isolated secrets, and access controls on our infrastructure. No service is 100% secure; if you believe your account has been compromised, email <Email /> immediately.
          </P>

          <H2>8. Children</H2>
          <P>
            Helm isn&apos;t intended for anyone under 16. If you believe a child has provided us personal information, contact <Email /> and we&apos;ll delete it.
          </P>

          <H2>9. AI-specific disclosures</H2>
          <UL>
            <li>Conversations with Helm&apos;s chat and content-generation features are sent to Anthropic&apos;s API to produce a response.</li>
            <li>Generated drafts and chat history are stored in your account so you can review and reuse them.</li>
            <li>AI output can be wrong, biased, outdated, or non-original. You&apos;re responsible for reviewing it before sending or publishing.</li>
            <li>We don&apos;t use your data to train our own models, and our AI provider has agreed not to train on your inputs by default.</li>
          </UL>

          <H2>10. Cookies</H2>
          <P>
            We use a single, essential, first-party session cookie to keep you signed in. Our analytics provider (Vercel) is designed to be cookie-less and privacy-preserving. If we add additional cookies in the future (e.g. preference cookies), we&apos;ll update this Policy and present a choice where required.
          </P>

          <H2>11. Changes to this Policy</H2>
          <P>
            We&apos;ll update this Policy from time to time. The &ldquo;Effective&rdquo; date at the top reflects the last change. For material changes we&apos;ll give reasonable advance notice (email, dashboard banner, or both).
          </P>

          <H2>12. Contact</H2>
          <P>
            For privacy questions, requests, or complaints: <Email />.<br />
            Sierra Sounds LLC operates Helm at <Code>helmos.co</Code>.
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
