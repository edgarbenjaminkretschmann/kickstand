// URLs for access-checked media. The stored path is added as a version so a new photo is not served from cache.

export function bikePhotoUrl(bike: { id: string; photoPath?: string | null }): string | null {
  if (!bike.photoPath) return null;
  const v = bike.photoPath.split("/").pop()?.replace(/\.jpg$/, "") ?? "";
  return `/media/bike/${bike.id}?v=${encodeURIComponent(v)}`;
}

export const photoUrl = (id: string) => `/media/photo/${id}`;
