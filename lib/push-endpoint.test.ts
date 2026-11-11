import { describe, expect, it } from "vitest";
import { pushEndpointOk, pushKeysOk } from "./push-endpoint";

describe("pushEndpointOk", () => {
  it("takes the push services browsers use", () => {
    for (const e of [
      "https://web.push.apple.com/QGk3abc",
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) expect(pushEndpointOk(e), e).toBe(true);
  });

  it("refuses anything else the server would be made to call", () => {
    for (const e of [
      "https://a.attacker.tld/n",
      "http://web.push.apple.com/x",
      "https://web.push.apple.com.attacker.tld/x",
      "https://attacker.tld/?web.push.apple.com",
      "https://user:pw@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/x",
      "notaurl",
      "",
      null,
      42,
      "https://fcm.googleapis.com/" + "a".repeat(2000),
    ]) expect(pushEndpointOk(e), String(e)).toBe(false);
  });
});

describe("pushKeysOk", () => {
  it("takes keys of a real subscription's shape only", () => {
    expect(pushKeysOk("B" + "a".repeat(86), "a".repeat(22))).toBe(true);
    expect(pushKeysOk("short", "a".repeat(22))).toBe(false);
    expect(pushKeysOk("B" + "a".repeat(86), { x: 1 })).toBe(false);
    expect(pushKeysOk("a".repeat(500), "a".repeat(22))).toBe(false);
  });
});
