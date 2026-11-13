"use client";

import { PostForm } from "./PostForm";

/** The monthly price is the post's "Capital needed", saved from the publish form itself. */
export function ShareFlow() {
  return (
    <div className="share">
      <PostForm onPublished={() => {}} />
    </div>
  );
}
