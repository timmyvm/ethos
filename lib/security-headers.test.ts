import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const prod = { supabaseUrl: "https://abc.supabase.co" };
const part = (csp: string, name: string) =>
  csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

describe("contentSecurityPolicy", () => {
  const csp = contentSecurityPolicy(prod);

  it("cannot be framed, and frames nothing", () => {
    expect(part(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(part(csp, "frame-src")).toBe("frame-src 'none'");
    expect(part(csp, "object-src")).toBe("object-src 'none'");
  });

  it("runs no script from another origin and no eval in production", () => {
    const scripts = part(csp, "script-src");
    expect(scripts).not.toMatch(/https?:|\*/);
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(scripts).toContain("'wasm-unsafe-eval'");
  });

  it("connects only to this origin and the Supabase project", () => {
    expect(part(csp, "connect-src")).toBe(
      "connect-src 'self' https://abc.supabase.co wss://abc.supabase.co"
    );
  });

  it("posts forms nowhere else and keeps the base", () => {
    expect(part(csp, "form-action")).toBe("form-action 'self'");
    expect(part(csp, "base-uri")).toBe("base-uri 'self'");
  });

  it("plays a take from a blob or the project's signed URL", () => {
    expect(part(csp, "media-src")).toContain("blob:");
    expect(part(csp, "media-src")).toContain("https://abc.supabase.co");
  });

  it("still builds with no Supabase URL, naming no host", () => {
    expect(contentSecurityPolicy({})).not.toMatch(/undefined|null/);
  });

  it("gives eval to the dev server only", () => {
    expect(part(contentSecurityPolicy({ ...prod, dev: true }), "script-src")).toContain("'unsafe-eval'");
  });

  it("lets the preview toolbar load on a preview only", () => {
    expect(csp).not.toContain("vercel.live");
    expect(contentSecurityPolicy({ ...prod, preview: true })).toContain("vercel.live");
  });
});

describe("securityHeaders", () => {
  const h = Object.fromEntries(securityHeaders(prod).map((x) => [x.key, x.value]));

  it("sends the set", () => {
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Strict-Transport-Security"]).toContain("includeSubDomains");
  });

  it("keeps the mic and the camera, and turns the rest off", () => {
    expect(h["Permissions-Policy"]).toContain("microphone=(self)");
    expect(h["Permissions-Policy"]).toContain("camera=(self)");
    expect(h["Permissions-Policy"]).toContain("geolocation=()");
  });
});
