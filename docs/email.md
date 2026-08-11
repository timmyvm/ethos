# Transactional email

Domain and mail are live (decisions 11 Aug, §9). This is the config the
app assumes, and the reasons behind the parts that look like details.

## The address

Everything sends **from `hello@speakethos.com`, with the reply-to set to
the same address**. There is no `noreply@` and there is not going to be
one: early replies to verification mails and streak reminders are free
user research, and the first hundred users replying to a confirmation
email with "hey does this work on iPhone" is worth more than a tidy
outbox.

Every template says so in the footer, so a reply is an obvious move
rather than a guess.

## Supabase Auth settings

Auth → Providers, Auth → Emails, and Auth → URL Configuration in the
Supabase dashboard:

| Setting | Value |
|---|---|
| Email provider | enabled |
| Confirm email | **on** — an unconfirmed address is not an account |
| Secure email change | on (confirms both the old and the new address) |
| Anonymous sign-ins | **on** — the whole product depends on it (DECISIONS #15) |
| Site URL | `https://speakethos.com` |
| Redirect allow-list | `https://speakethos.com/**`, the Vercel preview host, `http://localhost:3000/**` |

Custom SMTP (Auth → Emails → SMTP Settings) must be configured against
the live mailbox. Supabase's built-in sender is rate-limited to a
handful of emails an hour and sends from a Supabase address — fine for
one developer, not fine for a signup flow.

| SMTP field | Value |
|---|---|
| Sender email | `hello@speakethos.com` |
| Sender name | `Ethos` |
| Host / port / credentials | from the mail provider for `speakethos.com` |
| Minimum interval | leave at the default |

## Templates

`supabase/auth-email-templates/` holds the three that can actually be
sent by the flows in `lib/auth.ts`. Paste each into the matching template
in Auth → Emails:

| File | Supabase template | Sent when |
|---|---|---|
| `confirm-signup.html` | Confirm signup | a new account is created, **and** when an anonymous user attaches an email |
| `reset-password.html` | Reset password | `/auth/forgot` |
| `change-email.html` | Change Email Address | an account with an email swaps it |

All three exist because Supabase picks between them itself. Leave one on
the stock template and it arrives in a different voice with a different
sender name, which reads as a phishing attempt.

Magic-link and invite templates are deliberately not provided — the app
uses email and password, no social login (§0.2).

## Where the links land

Set in code, not in the dashboard, so the two can't drift:

- Signup / anonymous upgrade → `${NEXT_PUBLIC_SITE_URL}/auth/callback`
- Password reset → `${NEXT_PUBLIC_SITE_URL}/auth/reset`

Reset points straight at the form rather than through the shared
callback. That's not a shortcut: routing both through one page means the
page has to work out which kind of link it is by reading the URL
fragment, and the Supabase client consumes that fragment as it starts
up. Picking the destination when the mail is sent removes the race
entirely.

`NEXT_PUBLIC_SITE_URL` must be set in Vercel (production and preview) or
the links come back to whatever origin the browser happened to be on.

## Not built yet

Streak reminders by email. `lib/reminders.ts` schedules local
notifications and says plainly which tier the browser gave you; email is
the honest cross-platform answer for the browsers with no Notification
Triggers, and it needs a sending path of its own rather than Supabase
Auth's. Nothing here blocks it.
