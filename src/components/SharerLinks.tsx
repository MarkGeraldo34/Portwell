import type { Ethos } from "@/lib/ethos-types";
import { mailLink } from "@/lib/mail-link";

// X, Ethos and email shortcuts for a sharer. Works in server and client components (no hooks).
// The Ethos icon is /public/ethos-logo.png: replace that file with Ethos's official logo if you have it.

export function SharerLinks({ handle, email, ethos }: { handle?: string; email?: string; ethos?: Ethos }) {
  if (!handle && !email) return null;
  return (
    <div className="contact">
      {handle && (
        <a className="contact-btn" href={`https://x.com/${encodeURIComponent(handle)}`} target="_blank" rel="noopener noreferrer nofollow" title={`@${handle} on X`} aria-label={`@${handle} on X`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/x-logo.png" alt="" width={18} height={18} />
        </a>
      )}
      {handle && ethos && ethos.state !== "none" && (
        <a className="contact-btn ethos" href={ethos.url} target="_blank" rel="noopener noreferrer nofollow" title="Ethos reputation score" aria-label={ethos.state === "ok" ? `Ethos score ${ethos.score}` : "Ethos profile"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ethos-logo.png" alt="" width={16} height={16} />
          <b>{ethos.state === "ok" ? ethos.score : "–"}</b>
        </a>
      )}
      {handle && ethos?.state === "none" && (
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
