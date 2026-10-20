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
