"use client";

import { useCallback, useEffect, useState } from "react";
import { accountView, type AccountView } from "./account-settings";
import { supabaseBrowser } from "./supabase-browser";

/**
 * The account Settings' pages draw (#479): `undefined` while unknown,
 * then the session's own copy (offline too), then the server's. auth-js
 * hands a failed getUser back as user null with an error, which must not
 * read as "no account": a failed server read keeps the session's answer.
 * Unknown is never drawn as a guest (DESIGN principle 8).
 */
export function useAccount(): { account: AccountView | undefined; reread: () => void } {
  const [account, setAccount] = useState<AccountView | undefined>(undefined);
  const read = useCallback(() => {
    const db = supabaseBrowser();
    if (!db) {
      setAccount(accountView(null));
      return;
    }
    db.auth
      .getSession()
      .then(({ data }) => {
        const u = data.session?.user;
        setAccount(accountView(u ?? null));
        if (!u) return;
        return db.auth.getUser().then(({ data: fresh, error }) => {
          if (!error) setAccount(accountView(fresh.user));
        });
      })
      .catch(() => {});
  }, []);
  useEffect(read, [read]);
  return { account, reread: read };
}
