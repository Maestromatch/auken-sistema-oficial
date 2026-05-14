export const DEFAULT_OPTICA_SLUG = "glowvision";
export const OPTICA_SLUG_STORAGE_KEY = "auken_optica_slug";

export function normalizeSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getStoredOpticaSlug() {
  if (typeof window === "undefined") return DEFAULT_OPTICA_SLUG;
  return localStorage.getItem(OPTICA_SLUG_STORAGE_KEY) || DEFAULT_OPTICA_SLUG;
}

export function setStoredOpticaSlug(slug) {
  if (typeof window === "undefined") return;
  const safe = normalizeSlug(slug) || DEFAULT_OPTICA_SLUG;
  localStorage.setItem(OPTICA_SLUG_STORAGE_KEY, safe);
}

export function getOpticaSlugFromSearch(searchParams) {
  const raw = typeof searchParams?.get === "function" ? searchParams.get("optica") : null;
  return normalizeSlug(raw) || getStoredOpticaSlug();
}

export function slugFromOptica(optica) {
  return normalizeSlug(
    optica?.slug ||
    optica?.optica_slug ||
    optica?.optica_name ||
    optica?.nombre ||
    optica?.name
  ) || DEFAULT_OPTICA_SLUG;
}

export function buildTenantPath(path, slug, params = {}) {
  const search = new URLSearchParams();
  search.set("optica", normalizeSlug(slug) || DEFAULT_OPTICA_SLUG);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return path + "?" + search.toString();
}
