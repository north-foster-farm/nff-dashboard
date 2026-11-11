// C2 (#56): what the functions log carries no customer data, secret
// or push endpoint. Each part of an identifier is masked to its first
// three and last three characters (#496).
import { describe, it, expect, vi, afterEach } from "vitest";
import { mask, scrub, logError } from "./log.mjs";

const ENDPOINT =
  "https://fcm.googleapis.com/fcm/send/abcdef123456SECRETTAILxyz789";
const EMAIL = "pat.example@gmail.test";
const TOKEN = "Bearer sk_live_ABCDEFGHIJKLMNOP1234";

afterEach(() => vi.restoreAllMocks());

describe("mask", () => {
  it("keeps the first three and last three characters of a part", () => {
    expect(mask("abcdefghij")).toBe("abc***hij");
  });

  it("hides a part too short to show six characters", () => {
    expect(mask("abcdef")).toBe("***");
  });
});

describe("scrub", () => {
  it("masks each part of an email address", () => {
    expect(scrub(`mail ${EMAIL} now`)).toBe("mail pat***ple@gma***est now");
  });

  it("drops the path of a URL, masking the host", () => {
    const out = scrub(`failed at ${ENDPOINT}`);
    expect(out).not.toContain("SECRET");
    expect(out).not.toContain("/fcm/send");
  });

  it("masks a phone number", () => {
    expect(scrub("call 401-555-0142")).not.toContain("0142-");
    expect(scrub("call 401-555-0142")).not.toContain("555");
  });

  it("removes bearer tokens", () => {
    expect(scrub(`auth ${TOKEN}`)).not.toContain("ABCDEFGH");
  });
});

describe("logError", () => {
  it("logs a failed push without its body, endpoint or secrets", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = Object.assign(new Error(`push to ${ENDPOINT} failed`), {
      statusCode: 400,
      endpoint: ENDPOINT,
      body: `{"to":"${EMAIL}","auth":"${TOKEN}"}`,
    });

    logError("push.failed", failure);

    const line = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(line, "logged line").toContain("push.failed");
    expect(line, "logged status").toContain("400");
    for (const secret of ["SECRET", "pat.example", "ABCDEFGH", "/fcm/"]) {
      expect(line, `logged line leaks ${secret}`).not.toContain(secret);
    }
  });
});
