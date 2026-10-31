export function normalizeIdentity(value: string, kind: "email" | "instagram" | "linkedin") {
  let s = value.trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  if (kind === "instagram") s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/^@/, "");
  if (kind === "linkedin") s = s.replace(/^https?:\/\//, "").replace(/^(?:[a-z]{2,3}\.)?linkedin\.com\//, "linkedin.com/");
  return s;
}
