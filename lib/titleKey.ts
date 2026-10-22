/** Key used to match the same track across scans, uploads, follows and lists. */
export function titleKey(title: string | null | undefined): string {
  return String(title || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
    .replace(/\s*\(\s*(original|extended|club|radio|vocal|instrumental|dub|remaster|reprise)(\s+(mix|version|edit|cut))?\s*\)/gi, " ")
    .replace(/\s+/g, " ").trim().slice(0, 60);
}
