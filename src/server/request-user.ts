import { cleanName } from "@/server/data-check-service";

/** No auth yet: the page sends the typed "Your name" in the X-User-Name header (URI-encoded). */
export function requestUser(request: Request, bodyName?: unknown): string {
  const header = request.headers.get("x-user-name");
  let fromHeader = "";
  if (header) {
    try {
      fromHeader = decodeURIComponent(header);
    } catch {
      fromHeader = header;
    }
  }
  return cleanName(bodyName ?? fromHeader);
}