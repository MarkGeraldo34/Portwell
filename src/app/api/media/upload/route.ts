import { NextResponse } from "next/server";
import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { verifyProof, type Proof } from "@/lib/publish-auth";
import { realDeps } from "@/server/access";
import { blobProblem, blobToken, blobUsesOidc } from "@/server/blob-store";

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

/** Tells the browser which upload method this store needs. */
export async function GET() {
  return NextResponse.json({ mode: blobUsesOidc() ? "presigned" : "token" });
}

/** Checks the wallet proof and the path, and returns the limits for this file. Throws a readable error if not allowed. */
async function authorizeUpload(pathname: string, clientPayload: string | null) {
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
  return { allowedContentTypes: isVideo ? VIDEO_TYPES : IMAGE_TYPES, maximumSizeInBytes: isVideo ? MAX_VIDEO : MAX_IMAGE };
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const problem = blobProblem();
  if (problem) return NextResponse.json({ error: `Media storage is not ready: ${problem}.` }, { status: 503 });

  const body = (await request.json().catch(() => null)) as (HandleUploadBody | HandleUploadPresignedBody) | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    if (blobUsesOidc()) {
      const json = await handleUploadPresigned({
        body: body as HandleUploadPresignedBody,
        request,
        getSignedToken: async (pathname, clientPayload) => {
          const limits = await authorizeUpload(pathname, clientPayload);
          const token = await issueSignedToken({ pathname, operations: ["put"], ...limits });
          return { token, urlOptions: { ...limits, addRandomSuffix: true } };
        },
      });
      return NextResponse.json(json);
    }
    const json = await handleUpload({
      body: body as HandleUploadBody,
      request,
      token: blobToken(),
      onBeforeGenerateToken: async (pathname, clientPayload) => ({ ...(await authorizeUpload(pathname, clientPayload)), addRandomSuffix: true }),
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload not allowed" }, { status: 400 });
  }
}
