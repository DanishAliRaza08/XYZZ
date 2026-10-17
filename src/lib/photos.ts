// Product photos can be tagged with a variant colour (ProductImage.colour); untagged photos suit every colour.

/** Photos for the selected colour first (the first one is the main image), then photos for every colour. */
export function photosForColour<T extends { colour: string | null }>(images: T[], colour: string | undefined): T[] {
  const own = images.filter((i) => i.colour && i.colour === colour);
  const shared = images.filter((i) => !i.colour);
  const shown = [...own, ...shared];
  // Every photo is tagged with some other colour: show them all rather than an empty gallery.
  return shown.length ? shown : images;
}

/** The single photo that best shows a variant colour (bag, checkout). */
export function photoForColour<T extends { colour: string | null }>(images: T[], colour: string): T | undefined {
  return images.find((i) => i.colour === colour) ?? images.find((i) => !i.colour) ?? images[0];
}
