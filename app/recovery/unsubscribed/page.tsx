import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unsubscribed",
  robots: { index: false, follow: false },
};

export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const ok = status === "ok";
  const invalid = status === "invalid";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-16 flex items-center justify-center">
      <div className="max-w-md text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
          <span className="text-2xl font-bold text-white">H</span>
        </div>
        {ok ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">You&apos;re unsubscribed.</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              We&apos;ve stopped the win-back emails. Sorry to see you go — if there&apos;s anything we could&apos;ve done better, hit reply on the last email or write to <a href="mailto:support@helmos.co" className="text-[#a5b4fc] hover:underline">support@helmos.co</a>.
            </p>
          </>
        ) : invalid ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Hmm, that link didn&apos;t work.</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              The unsubscribe link looks invalid or expired. Reply to any Helm email saying &ldquo;unsubscribe&rdquo; and we&apos;ll handle it manually, or write to <a href="mailto:support@helmos.co" className="text-[#a5b4fc] hover:underline">support@helmos.co</a>.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Missing details.</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              We couldn&apos;t find an email or token on this link. Please use the link from the email you received.
            </p>
          </>
        )}
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 mt-2">← Back to helmos.co</Link>
      </div>
    </div>
  );
}
