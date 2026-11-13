import type { Ethos } from "@/lib/ethos-types";
import { mailLink } from "@/lib/mail-link";

// X, Ethos and email shortcuts for a sharer. Works in server and client components (no hooks).
// The Ethos icon is /public/ethos-logo.png: replace that file with Ethos's official logo if you have it.

export function SharerLinks({ handle, email, ethos, verified = false }: { handle?: string; email?: string; ethos?: Ethos; verified?: boolean }) {
  if (!handle && !email) return null;
  // The X link and the Ethos score are only shown for a handle the sharer proved they own (tweet challenge).
  // Otherwise anyone could type a well-known handle and borrow that person's reputation.
  const proven = !!handle && verified;
  return (
    <div className="contact">
      {handle && !verified && (
        <span className="contact-btn unverified" title={`This sharer has not proven they own @${handle}. Do not trust the handle or any reputation linked to it.`}>
          <span aria-hidden="true">⚠</span> Unverified X handle
        </span>
      )}
      {proven && (
        <a className="contact-btn" href={`https://x.com/${encodeURIComponent(handle)}`} target="_blank" rel="noopener noreferrer nofollow" title={`@${handle} on X`} aria-label={`@${handle} on X`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/x-logo.png" alt="" width={18} height={18} />
          <span className="xv-tick" aria-label="Verified">✓</span>
        </a>
      )}
      {proven && ethos && ethos.state !== "none" && (
        <a className="contact-btn ethos" href={ethos.url} target="_blank" rel="noopener noreferrer nofollow" title="Ethos reputation score" aria-label={ethos.state === "ok" ? `Ethos score ${ethos.score}` : "Ethos profile"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ethos-logo.png" alt="" width={16} height={16} />
          <b>{ethos.state === "ok" ? ethos.score : "–"}</b>
        </a>
      )}
      {proven && ethos?.state === "none" && (
        <span className="contact-btn ethos off" title="This X account has no Ethos profile yet">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ethos-logo.png" alt="" width={16} height={16} />
          <span>No Ethos score</span>
        </span>
      )}
      {email && (
        <a className="contact-btn" href={mailLink(email).href} target={mailLink(email).webmail ? "_blank" : undefined} rel="noopener noreferrer nofollow" title={`Email ${email}`} aria-label={`Email ${email}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gmail-logo.png" alt="" width={18} height={18} />
        </a>
      )}
    </div>
  );
}
