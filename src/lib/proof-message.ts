// Browser-safe part of the wallet proof (no Node imports): the text a wallet signs for publishing or uploading.
export const APP = "portwell";
export const RECIPIENT = "portwell";

export type ProofKind = "publish" | "upload" | "delete" | "update";

export const proofMessage = (kind: ProofKind, account: string, iat: number, hash?: string) =>
  JSON.stringify(kind === "publish" || kind === "delete" || kind === "update" ? { app: APP, action: kind, account, hash, iat } : { app: APP, action: kind, account, iat });
