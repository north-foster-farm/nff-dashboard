// What the functions log. Never a customer's contact details, a
// secret, a push endpoint or a raw error body (C2, #56). Each part of
// an identifier is masked to its first three and last three
// characters (#496), matching the site's rule.

const KEEP = 3;

// "abcdefghij" -> "abc***hij"; a part of six characters or fewer
// would show all of itself, so it shows none.
export const mask = (part) => {
  const text = String(part);
  return text.length > KEEP * 2
    ? `${text.slice(0, KEEP)}***${text.slice(-KEEP)}`
    : "***";
};

const EMAIL = /([A-Za-z0-9._%+'-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;
const URL_RE = /https?:\/\/([^\s/"'<>]+)[^\s"'<>]*/g;
const PHONE = /[+(]?\d[\d\s().-]{8,}\d/g;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const KEY = /\b(?:sk|pk|rk)_[A-Za-z0-9_]{8,}/g;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;

// Order matters: bearer tokens and emails go before URLs, whose
// path and query (where push endpoints keep their secret) are dropped.
export const scrub = (value) =>
  String(value)
    .replace(BEARER, "$1 [removed]")
    .replace(JWT, "[removed]")
    .replace(KEY, "[removed]")
    .replace(EMAIL, (_, local, domain) => `${mask(local)}@${mask(domain)}`)
    .replace(URL_RE, (_, host) => `[url:${mask(host)}]`)
    .replace(PHONE, (m) => (m.replace(/\D/g, "").length >= 10 ? "[phone]" : m));

// One JSON line for a failure: the event, the status code and the
// scrubbed message. The error's body, endpoint and other properties
// are never read.
export function logError(event, error) {
  const status = error?.statusCode ?? error?.status ?? error?.code ?? null;
  const message = scrub(error?.message ?? "").slice(0, 300);
  console.error(JSON.stringify({ event, status, message }));
}
