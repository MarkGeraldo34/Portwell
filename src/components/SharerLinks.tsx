import { FaXTwitter } from "react-icons/fa6";
import type { Ethos } from "@/lib/ethos-types";

// X, Ethos and email shortcuts for a sharer. Works in server and client components (no hooks).
// The Ethos icon is /public/ethos-logo.svg: replace that file with Ethos's official logo if you have it.

export function SharerLinks({ handle, email, ethos }: { handle?: string; email?: string; ethos?: Ethos }) {
  if (!handle && !email) return null;
  return (
    <div className="contact">
      {handle && (
        <a className="contact-btn" href={`https://x.com/${encodeURIComponent(handle)}`} target="_blank" rel="noopener noreferrer nofollow" title={`@${handle} on X`} aria-label={`@${handle} on X`}>
          <FaXTwitter size={16} aria-hidden="true" />
        </a>
      )}
      {handle && ethos && ethos.state !== "none" && (
        <a className="contact-btn ethos" href={ethos.url} target="_blank" rel="noopener noreferrer nofollow" title="Ethos reputation score" aria-label={ethos.state === "ok" ? `Ethos score ${ethos.score}` : "Ethos profile"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ethos-logo.svg" alt="" width={16} height={16} />
          <b>{ethos.state === "ok" ? ethos.score : "–"}</b>
        </a>
      )}
      {handle && ethos?.state === "none" && (
        <span className="contact-btn ethos off" title="This X account has no Ethos profile yet">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ethos-logo.svg" alt="" width={16} height={16} />
          <span>No Ethos score</span>
        </span>
      )}
      {email && (
        <a className="contact-btn" href={`mailto:${email}`} rel="nofollow" title={`Email ${email}`} aria-label={`Email ${email}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </a>
      )}
    </div>
  );
}
