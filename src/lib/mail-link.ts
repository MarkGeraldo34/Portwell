// Link that opens the sharer's inbox in the browser. A plain mailto: does nothing when the device has no
// desktop mail app, so well-known webmail addresses open that webmail's compose window instead.
export function mailLink(email: string): { href: string; webmail: boolean } {
  const to = encodeURIComponent(email);
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain === "gmail.com" || domain === "googlemail.com") return { href: `https://mail.google.com/mail/?view=cm&fs=1&to=${to}`, webmail: true };
  if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) return { href: `https://outlook.live.com/mail/0/deeplink/compose?to=${to}`, webmail: true };
  if (domain === "yahoo.com" || domain === "ymail.com") return { href: `https://compose.mail.yahoo.com/?to=${to}`, webmail: true };
  return { href: `mailto:${email}`, webmail: false };
}
