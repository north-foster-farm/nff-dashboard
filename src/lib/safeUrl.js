// A link taken from data (a tracking URL an admin typed, one a carrier
// or Square may one day send) is text from outside. React puts an href
// in the page as it finds it, so a "javascript:" URL would run on
// click. This lets through web addresses only.

// -> the normalized address when `value` is an http or https URL, else
// null. The URL parser reads through the tabs and line breaks a
// browser ignores inside a scheme ("java\tscript:"), so those cannot
// slip past a plain prefix check.
export const safeHttpUrl = (value) => {
  if (typeof value !== "string") return null;

  let parsed;

  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }

  return parsed.protocol === "http:" || parsed.protocol === "https:"
    ? parsed.href
    : null;
};
