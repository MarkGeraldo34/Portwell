import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyProof, type Proof } from "@/lib/publish-auth";
import { realDeps } from "@/server/access";
import { blobConfigured } from "@/server/blob-store";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024; // about one minute of phone video; the one-minute length is checked in the browser

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 30;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  if (!blobConfigured()) return NextResponse.json({ error: "Media storage is not set up yet (Vercel Blob)." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let proof: Proof;
        try {
          proof = JSON.parse(clientPayload ?? "") as Proof;
        } catch {
          throw new Error("Sign in with your wallet before uploading.");
        }
        const res = await verifyProof(proof, "upload", realDeps);
        if (!res.ok) throw new Error(res.error);
        // Files may only be written under the uploader's own folder.
        if (!pathname.startsWith(`media/${res.accountId}/`) || pathname.length > 160 || pathname.includes("..")) {
          throw new Error("Invalid upload path");
        }
        const isVideo = /\.(mp4|webm|mov)$/i.test(pathname);
        return {
          allowedContentTypes: isVideo ? VIDEO_TYPES : IMAGE_TYPES,
          maximumSizeInBytes: isVideo ? MAX_VIDEO : MAX_IMAGE,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload not allowed" }, { status: 400 });
  }
}
