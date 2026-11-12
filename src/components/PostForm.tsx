"use client";

import { useRef, useState } from "react";
import { Buffer } from "buffer";
import { upload, uploadPresigned } from "@vercel/blob/client";
import { useWallet } from "./WalletProvider";
import { hashPost, normalizePost, POST_LIMITS, validateMedia, type PostInput } from "@/lib/post-format";
import { proofMessage, RECIPIENT, type ProofKind } from "@/lib/proof-message";
import { scanPost } from "@/lib/risk";
import { requireAiApproval } from "@/lib/ai-gate";

interface Proof {
  accountId: string;
  publicKey: string;
  signature: string;
  message: string;
  nonce: string;
}
interface MediaEntry {
  url: string;
  upload: boolean;
  label: string;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/avif": "avif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 60;
const UPLOAD_PROOF_MS = 8 * 60 * 1000; // server accepts a proof for 10 minutes

const SCAM_EXAMPLE = {
  title: "Double your NEAR in 7 days",
  summary: "Guaranteed 20% daily returns, risk-free. Act now, only 5 spots left! Bring friends into your downline.",
  steps: "Send me 10 NEAR to my wallet first\nEnter your seed phrase to verify your account",
  risks: "none, completely risk free",
};

function videoSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this video."));
    };
    v.src = url;
  });
}

export function PostForm({ onPublished }: { onPublished: () => void }) {
  const { accountId, signIn, signMessage } = useWallet();
  const [f, setF] = useState({ title: "", summary: "", steps: "", risks: "", risk: "medium", capital: "0", xHandle: "", email: "" });
  const [media, setMedia] = useState<MediaEntry[]>([]);
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadProof = useRef<{ proof: Proof; at: number } | null>(null);
  const uploadMode = useRef<"token" | "presigned" | null>(null);

  const say = (text: string, isBad = false) => {
    setMsg(text);
    setBad(isBad);
  };

  async function sign(kind: ProofKind, hash?: string): Promise<Proof> {
    if (!accountId) throw new Error("Connect your wallet first.");
    const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
    const message = proofMessage(kind, accountId, Date.now(), hash);
    const signed = await signMessage({ message, recipient: RECIPIENT, nonce });
    return { accountId: signed.accountId, publicKey: signed.publicKey, signature: signed.signature, message, nonce: nonce.toString("base64") };
  }

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!accountId) return signIn();
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (media.length >= POST_LIMITS.media) throw new Error(`You can add at most ${POST_LIMITS.media} media items.`);
        const ext = EXT[file.type];
        if (!ext) throw new Error(`${file.name}: only JPG, PNG, GIF, WebP, AVIF, MP4, WebM and MOV files are allowed.`);
        const isVideo = file.type.startsWith("video/");
        if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) throw new Error(`${file.name} is too large (images up to 8 MB, videos up to 100 MB).`);
        if (isVideo) {
          const secs = await videoSeconds(file);
          if (!Number.isFinite(secs) || secs > MAX_VIDEO_SECONDS + 0.5) throw new Error(`${file.name} is longer than 1 minute.`);
        }
        say("Waiting for your wallet to sign. This is free and sends no transaction.");
        if (!uploadProof.current || Date.now() - uploadProof.current.at > UPLOAD_PROOF_MS) {
          uploadProof.current = { proof: await sign("upload"), at: Date.now() };
        }
        say(`Uploading ${file.name}…`);
        if (!uploadMode.current) {
          const m = await fetch("/api/media/upload").then((r) => r.json()).catch(() => ({ mode: "token" }));
          uploadMode.current = m.mode === "presigned" ? "presigned" : "token";
        }
        const send = uploadMode.current === "presigned" ? uploadPresigned : upload;
        const blob = await send(`media/${accountId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`, file, {
          access: "public",
          handleUploadUrl: "/api/media/upload",
          clientPayload: JSON.stringify(uploadProof.current.proof),
        });
        setMedia((m) => [...m, { url: blob.url, upload: true, label: file.name }]);
      }
      say("");
    } catch (e) {
      say(e instanceof Error ? e.message : "Upload failed", true);
    } finally {
      setUploading(false);
    }
  }

  function addLink() {
    const v = validateMedia({ url: link });
    if (!v.ok) return say(v.error, true);
    if (media.length >= POST_LIMITS.media) return say(`You can add at most ${POST_LIMITS.media} media items.`, true);
    if (media.some((m) => m.url === v.value.url)) return say("That link is already added.", true);
    setMedia((m) => [...m, { url: v.value.url, upload: false, label: v.value.url }]);
    setLink("");
    say("");
  }

  async function publish() {
    if (!accountId) return signIn();
    const input: PostInput = {
      title: f.title,
      summary: f.summary,
      steps: f.steps.split("\n"),
      risks: f.risks,
      risk: f.risk,
      capitalNeededNear: f.capital,
      xHandle: f.xHandle,
      email: f.email,
      media: media.map((m) => ({ url: m.url, upload: m.upload })),
    };
    const norm = normalizePost(input);
    if (!norm.ok) return say(norm.error, true);
    // Quick local check so an obvious scam never reaches the wallet or the server.
    const quick = scanPost({ title: norm.value.title, summary: norm.value.summary, steps: norm.value.steps, risks: norm.value.risks, risk: norm.value.risk, capitalNeededNear: norm.value.capitalNeededNear });
    if (quick.verdict === "block") return say(`The scam check blocked this post: ${quick.findings[0]?.message ?? "it looks unsafe"}. Please reword it.`, true);

    setBusy(true);
    try {
      // The AI scam review runs first and automatically, so a blocked post never costs a wallet signature.
      say("Running the AI scam review…");
      const blocked = await requireAiApproval({ title: norm.value.title, summary: norm.value.summary, steps: norm.value.steps, risks: norm.value.risks, risk: norm.value.risk, capitalNeededNear: norm.value.capitalNeededNear });
      if (blocked) return say(blocked, true);
      say("AI review passed. Waiting for your wallet to sign. This is free and sends no transaction.");
      const auth = await sign("publish", await hashPost(norm.value));
      say("Publishing…");
      const res = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ post: input, auth }) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return say(json.error ?? "Could not publish. Try again.", res.status === 422 || res.status === 503);
      say("Published. Your post is now on the feed.");
      setF({ title: "", summary: "", steps: "", risks: "", risk: "medium", capital: "0", xHandle: f.xHandle, email: f.email });
      setMedia([]);
      onPublished();
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not publish", true);
    } finally {
      setBusy(false);
    }
  }

  const text = (k: keyof typeof f, label: string, opts: { multi?: boolean; ph?: string; max?: number; type?: string } = {}) => (
    <label>
      {label}
      {opts.multi ? (
        <textarea rows={3} value={f[k]} maxLength={opts.max} placeholder={opts.ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      ) : (
        <input type={opts.type ?? "text"} value={f[k]} maxLength={opts.max} placeholder={opts.ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      )}
    </label>
  );

  return (
    <section className="card">
      <h3>Share a strategy post</h3>
      <p className="muted">
        Post the strategy you are looking to share with others while you get paid
      </p>
      {text("title", "Title", { max: POST_LIMITS.title })}
      {text("summary", "Summary (shown to everyone)", { multi: true, max: POST_LIMITS.summary })}
      {text("steps", "Steps (one per line, shown only to subscribers)", { multi: true, max: 3000 })}
      {text("risks", "Risks and downsides (shown only to subscribers)", { multi: true, max: POST_LIMITS.risks })}
      <div className="row two">
        <label>
          Risk level
          <select value={f.risk} onChange={(e) => setF({ ...f, risk: e.target.value })}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
        {text("capital", "Capital needed (NEAR)", { max: 12 })}
      </div>
      <div className="row two">
        {text("xHandle", "Your X handle (required)", { ph: "@yourhandle", max: 16 })}
        {text("email", "Your email (required)", { ph: "you@example.com", max: POST_LIMITS.email, type: "email" })}
      </div>

      <div className="media-edit">
        <b>Media (optional)</b>
        <p className="muted" style={{ margin: "2px 0 8px" }}>
          Up to {POST_LIMITS.media} items: images or videos up to 1 minute, or links to images and videos.
        </p>
        {media.length > 0 && (
          <ul className="media-list">
            {media.map((m) => (
              <li key={m.url}>
                <span>{m.upload ? "Uploaded" : "Link"}: {m.label.length > 50 ? `${m.label.slice(0, 50)}…` : m.label}</span>
                <button type="button" className="icon-btn" aria-label="Remove" title="Remove" onClick={() => setMedia((x) => x.filter((y) => y.url !== m.url))}>×</button>
              </li>
            ))}
          </ul>
        )}
        <div className="row">
          <label className={`btn ghost${uploading ? " disabled" : ""}`} style={{ margin: 0 }}>
            {uploading ? "Uploading…" : "Upload image or video"}
            <input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,image/avif,video/mp4,video/webm,video/quicktime" disabled={uploading || busy}
              onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        <div className="row">
          <input value={link} placeholder="https://… link to an image or video" onChange={(e) => setLink(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <button type="button" className="btn ghost" onClick={addLink}>Add link</button>
        </div>
      </div>

      <div className="row">
        <button className="btn" disabled={busy || uploading} onClick={() => void publish()}>
          {!accountId ? "Connect wallet to publish" : busy ? "Publishing…" : "Publish post"}
        </button>
        <button className="btn ghost" type="button" onClick={() => setF({ ...f, ...SCAM_EXAMPLE, xHandle: f.xHandle || "@scamdemo", email: f.email || "demo@example.com" })}>
          Load a scam example
        </button>
      </div>
      {msg && <p className={bad ? "ai-msg" : "muted"} role={bad ? "alert" : "status"}>{msg}</p>}
    </section>
  );
}
