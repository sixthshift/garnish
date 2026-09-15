/** The picture on an entry card, or a placeholder square so the rows line up. */
export function EntryImage({ src }: { src: string | null }) {
  const size = "h-9 w-9 shrink-0 rounded-md";
  return src === null ? (
    <div data-placeholder="image" aria-hidden="true" className={`${size} bg-bg-subtle`} />
  ) : (
    <img src={src} alt="" loading="lazy" className={`${size} object-cover`} />
  );
}
