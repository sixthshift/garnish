import { dataUrlFile, fetchedImageFile } from "../../../lib/images";
import { fetchImage } from "../../../server/import/imageFetch";

/**
 * An imported recipe's picture as a file to upload. A `data:` URL is already
 * the bytes — an image out of an uploaded Mealie backup — so it is rebuilt here
 * rather than fetched through the server, which only reads http(s).
 */
export async function imageFromUrl(url: string): Promise<File> {
  return url.trim().startsWith("data:") ? dataUrlFile(url) : fetchedImageFile(await fetchImage({ data: { url } }));
}
