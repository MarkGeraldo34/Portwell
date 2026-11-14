import type { MediaItem } from "@/lib/post-format";
import ScrollImageReveal from "./ScrollImageReveal";

// Shows a post's images and videos. Plain links (for example a YouTube link) are shown as buttons.
export function MediaGallery({ media }: { media: MediaItem[] }) {
  if (media.length === 0) return null;
  return (
    <div className="media-grid">
      {media.map((m) =>
        m.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <a key={m.url} href={m.url} target="_blank" rel="noopener noreferrer nofollow" className="media-item">
            <ScrollImageReveal src={m.url} alt="Shared by the sharer" mask="wipe" direction="left" parallax={16} className="sir-frame small" rounded="sir-round" />
          </a>
        ) : m.kind === "video" ? (
          <video key={m.url} className="media-item" src={m.url} controls preload="metadata" playsInline />
        ) : (
          <a key={m.url} href={m.url} target="_blank" rel="noopener noreferrer nofollow" className="media-link">
            ↗ {new URL(m.url).hostname}
          </a>
        ),
      )}
    </div>
  );
}
