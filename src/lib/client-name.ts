type NamedClient = { first_name?: string | null; last_name?: string | null } | null | undefined;

/** A client's name as the clinic files it: last name, then first name ("ברק תמר"). */
export function clientFullName(client: NamedClient): string {
  return [client?.last_name, client?.first_name]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}
