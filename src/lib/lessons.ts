// Lessons: what a sharer posts for ONE learner's request, after that learner subscribed through the request's
// "View and subscribe" page. Pure helpers (rules and shapes) so they can be tested.

export const LESSON_LIMITS = { title: 120, body: 3000 };

export interface Lesson {
  title: string;
  body: string;
  ts: number;
}

export const isRequestId = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(s);

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, " ").trim() : "");

export function validateLesson(raw: { title?: unknown; body?: unknown }): { ok: true; value: { title: string; body: string } } | { ok: false; error: string } {
  const title = clean(raw.title).replace(/\s+/g, " ");
  const body = clean(raw.body);
  if (title.length < 3) return { ok: false, error: "Give the lesson a short title (at least 3 characters)." };
  if (title.length > LESSON_LIMITS.title) return { ok: false, error: `Keep the title under ${LESSON_LIMITS.title} characters.` };
  if (body.length < 10) return { ok: false, error: "Write the lesson itself (at least 10 characters)." };
  if (body.length > LESSON_LIMITS.body) return { ok: false, error: `Keep the lesson under ${LESSON_LIMITS.body} characters.` };
  return { ok: true, value: { title, body } };
}
