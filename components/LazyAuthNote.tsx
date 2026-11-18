"use client";

import dynamic from "next/dynamic";

/*
 * What a sign-in just did (#497), loaded after the page rather than with
 * it (#508, the speed audit's fix 18). It draws nothing on almost every
 * open, yet its reads of the walk's answers carried the 365 topics into
 * the code every page parses before anything is live. The note it shows
 * waits for its own code, a beat after the page lands.
 */
export const AuthNote = dynamic(() => import("@/components/AuthNote").then((m) => m.AuthNote), { ssr: false });
