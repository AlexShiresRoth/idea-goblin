# Roadmap

## Next

### Monetization: Pro plan, credits and top-ups

Analysis is the expensive part, so charge for it. Capturing ideas and
buckets stays free.

1. **Confirm cost per run.** `ai_runs` already records input, output and
   reasoning tokens per run, by route and user. Check the estimates below
   against real data before setting final prices:

   ```sql
   select route, model, count(*) runs,
     round(avg(input_tokens)) avg_in, round(avg(output_tokens)) avg_out,
     round(avg(reasoning_tokens)) avg_reasoning,
     max(input_tokens) max_in, max(output_tokens) max_out
   from ai_runs group by route, model order by route;
   ```

   Estimates from the code's limits and published prices (Oct 2026,
   third-party sources; check OpenAI's pricing page). gpt-5.4-mini is
   $0.75 / $4.50 per 1M input/output tokens; gpt-6-astra is $10 / $50:

   | Route | Model | Typical | Worst case |
   |---|---|---|---|
   | execution / analysis | mini (output capped at 4k) | ~$0.01 | ~$0.03 |
   | refinement | astra (no output cap) | ~$0.25–0.35 | ~$0.80+ |
   | idea-create / bucket-classify | mini | < $0.001 | < $0.002 |

2. **Cap refinement output** (`max_output_tokens` ~8k) before launch.
   Fixed credit prices only hold if the most expensive run has a ceiling.
3. **Credits, not tokens.** Each action has a fixed credit price; we absorb
   per-run variance. Cached runs are free. Keep the hourly `RATE_LIMITS` as
   abuse protection only.
4. **Tiers** (adjust once step 1 has real numbers):

   | | Free | Pro ($10/mo) |
   |---|---|---|
   | Ideas and buckets | Unlimited | Unlimited |
   | Monthly credits | 20 | 200 |
   | Execution / analysis run | 1 credit | 1 credit |
   | Refinement | Mini model, 5 credits | Premium model, 10 credits |
   | Top-ups | — | 100 credits for $5 |
   | Buckets per execution run | 5 | 8 |
   | Version history | Last 3 per bucket | Unlimited |

   Worst-case Pro user (all credits on premium refinements) costs ~$6–7 a
   month; a typical one ~$1–2. A 100-credit top-up costs at most ~$3 to
   serve.

5. **Credit rules:**
   - Monthly credits reset each billing period; purchased credits never
     expire. Spend monthly credits first.
   - Show the cost and remaining balance before a run ("Refine · 10
     credits · 140 left").
   - Warn at 20% remaining. At zero, show an upgrade or top-up prompt, not a
     bare error.

6. **Build it:**
   - `plan` column on `profiles`.
   - `credit_purchases` table (profile, credits, Stripe payment id,
     created at) for top-ups.
   - Monthly usage derived from `ai_runs` for the billing period, weighted
     by route, the same way `isRateLimited` counts runs today. Balance =
     plan allowance − monthly usage, then purchased credits − overflow.
   - The analyze route returns 402 with an upgrade/top-up message when a
     user is out of credits, next to the existing 429 check.
   - The modal shows the run's cost and remaining credits before it starts.
   - Stripe Checkout for the subscription and for one-off top-up packs, a
     webhook that sets `plan` and records purchases, and the Stripe
     customer portal for cancellations.

7. **Later, if top-ups sell a lot:** add a $15–20 tier with more monthly
   credits. Heavy users often prefer a predictable bill to repeated
   top-ups.

### Make the gameplan a daily habit

The gameplan is what sets Idea Goblin apart from "AI analyzes your ideas".
Its value comes from people coming back to it, not reading it once.

1. **"Next up" on the board.** A strip at the top of the board with the
   next step that isn't done yet from each bucket's latest gameplan. It
   answers "what do I do today?" whenever the app opens.
2. **Flag plans that have gone stale.** When ideas are added or marked done
   after a plan was saved, show "N ideas changed since this plan, update
   it?" on the Gameplan tab, so a plan never quietly drifts out of date.
3. **Celebrate finishing.** A small moment when a phase or a whole bucket
   is done. It's an app about actually finishing things.

### Friendlier UI

1. **Name actions by outcome, not by tool.** "Analyze Vault", "Idea
   Execution" and "pathway" read like an AI tool menu. Use the user's
   questions instead: "What should I work on?" (execution), "Sharpen this
   idea" (refinement), "How do I finish this?" (gameplan). Refine and
   Gameplan live in the bucket; the vault-wide modal keeps only "What
   should I work on?".
2. **Fewer decisions.**
   - One way to save: gameplans save to their bucket automatically, and
     refinement only asks whether to apply it. That retires the separate
     "Save Analysis" / "Update bucket" / "Save to bucket" buttons.
   - The bucket header has five actions. Merge Add and Import into one
     button with a dropdown, and move Delete into a "⋯" menu.
   - Once results live in their buckets, the saved-analyses page becomes
     history, not a second place to look.
3. **Safe deletes.** Deleting a bucket or idea happens on one click today.
   Add an undo toast (or a confirm step), using the same archive approach
   as Done.
4. **Readable contrast.** Much of the text is `text-white/40–50` at
   `text-xs` on black. Raise secondary text to at least WCAG AA contrast.
5. **Plain words on controls.** Keep the goblin voice in flavour text, but
   buttons and statuses say what they do ("Saving…", not "Stashing it in
   the hoard").
6. **First run.** A new user lands on an empty board. Guide them: paste or
   import ideas → Goblin sorts them → it offers a gameplan for the biggest
   bucket, so the "here's how to finish it" moment happens in the first
   minute.
7. **Mobile bucket view.** On phones the Gameplan tab ends up below the
   whole ideas list. Use Ideas / Gameplan / Versions tabs there instead
   of stacking.

### More sign-in options

GitHub is the only way in today, which shuts out most people who aren't
developers. Do this before bucket sharing: an invite is useless if the
person you send it to can't sign in.

1. **Google.** `AuthButton` already accepts `"google"`. Create an OAuth
   client in Google Cloud, enable the provider in Supabase, and render a
   second button on the landing page. The existing `/auth/callback`
   handles it unchanged.
2. **Email and password.**
   - Sign-up and sign-in forms using `signUp` / `signInWithPassword`.
     Ask for a name at sign-up and pass it as `options.data.name`, or
     `ensureProfile` falls back to "Goblinner".
   - Email confirmation, with `emailRedirectTo` pointing at
     `/auth/callback?next=/main`.
   - "Forgot password": `resetPasswordForEmail` plus an update-password
     page.
   - Configure custom SMTP in Supabase before launch; the built-in sender
     is heavily rate-limited.
3. **One account per person.** Supabase links identities that share a
   verified email, so signing in with Google after GitHub reaches the same
   ideas. Check this works, and show a clear message when an email is
   already registered with a different method.

### Share buckets

Let people send a bucket to someone else. Depends on more sign-in options.

1. **Bucket page.** `/main/buckets/[id]` for a single bucket. Buckets
   only appear in the `/main` grid today; this page is useful on its own
   and is what the shared view builds on.
2. **Read-only share link.** A nullable, unique `share_token` on
   `idea_buckets` and a public page at `/share/[token]`, outside `/main`
   (which redirects signed-out visitors). Anyone with the link can view
   it, signed in or not. It shows the ideas and the bucket's latest
   gameplan, but not version history. The owner turns sharing on or off;
   regenerating the token revokes old links. Bucket ids are serial, so
   never put them in the shared URL. Mark the page noindex.
3. **Save a copy.** A signed-in viewer can clone the bucket and its ideas
   into their own account. Each copy has one owner, so focus, gameplans
   and AI costs keep working unchanged.
4. **Later: collaborators.** `bucket_members` (bucket, profile, viewer or
   editor role) and `bucket_invites` (token, role, optional email,
   expiry), with a "Shared with me" section on the board. Every route
   checks `profileId = session.user.id` directly today, so this needs one
   `getBucketAccess(bucketId, userId)` helper used everywhere first.
   Questions to settle before building it:
   - Ideas can sit in several buckets. Can an editor change an idea that
     is also in the owner's other buckets?
   - Whose focus slot does a shared bucket use?
   - Who is charged credits when an editor runs a gameplan?

   Likely a Pro feature.
