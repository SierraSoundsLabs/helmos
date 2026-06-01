import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with Helm — email support, common questions, and how to reach the team.",
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-16">
      <div className="max-w-2xl mx-auto flex flex-col gap-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
            <span className="text-2xl font-bold text-white">H</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">We&apos;re here to help</h1>
          <p className="text-sm text-zinc-400 max-w-md leading-relaxed">
            Whether you&apos;ve got a question, a bug, a request, or just want to tell us how Helm&apos;s working for you — write to us. We read every email.
          </p>
        </div>

        <a
          href="mailto:support@helmos.co"
          className="self-center inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-[#6366f1] hover:bg-[#5558e8] transition-colors"
        >
          📬 Email support@helmos.co
        </a>

        <div className="grid gap-4">
          <SupportCard
            title="Billing or subscription"
            body="Update your card, change plan, cancel, or ask about a charge. Include your account email."
          />
          <SupportCard
            title="Something broken or unexpected"
            body="Tell us what you were doing and what you saw. A screenshot or recording is gold — paste any error message verbatim."
          />
          <SupportCard
            title="Feature request or feedback"
            body="What would make Helm work harder for you? We prioritize what paying users actually ask for."
          />
          <SupportCard
            title="Account access / login"
            body={
              <>
                Lost your password? Reset it on the{" "}
                <Link href="/forgot-password" className="text-[#a5b4fc] hover:underline">
                  Forgot password page
                </Link>
                . If you can&apos;t get in after that, email us with the address on your account.
              </>
            }
          />
          <SupportCard
            title="Data export or account deletion"
            body="Email us and we&apos;ll handle it within 30 days, per our Privacy Policy."
          />
        </div>

        <p className="text-xs text-zinc-600 text-center">
          Typical response: within 1 business day. Helm is operated by Sierra Sounds LLC.
        </p>

        <div className="flex justify-center">
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Back to helmos.co</Link>
        </div>
      </div>
    </div>
  );
}

function SupportCard({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
      <p className="text-sm font-semibold text-white mb-1">{title}</p>
      <p className="text-xs text-zinc-400 leading-relaxed">{body}</p>
    </div>
  );
}
