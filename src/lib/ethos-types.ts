export type Ethos =
  | { state: "ok"; score: number; url: string }
  | { state: "none" } // the X account has no Ethos profile
  | { state: "unknown"; url: string }; // Ethos could not be reached right now
