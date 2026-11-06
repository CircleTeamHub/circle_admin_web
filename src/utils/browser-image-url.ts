/** COS public originals support on-demand JPEG previews; never rewrite signed/private URLs. */
export function browserImageUrl<T extends string | null | undefined>(url: T): T | string {
  return url && /^https?:\/\/[^?#]+\/circle\/(?:avatars|covers|posts|friends|uploads)\/[^?#]+\.hei[cf]$/i.test(url)
    ? `${url}?imageMogr2/format/jpg`
    : url;
}
