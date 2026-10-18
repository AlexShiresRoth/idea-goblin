# Roadmap

## Next

### Monetization: tiers and analysis credits

Analysis is the expensive part, so charge for it. Capturing ideas and
buckets stays free.

1. **Measure cost per run.** `ai_runs` already records input, output and
   reasoning tokens per run, by route and user. Combine those with the
   models' per-token prices to get the typical and worst-case cost of each
   route, and the cost per active user per month. Set prices from this, not
   before.
2. **Monthly credits weighted by cost.** Refinement (premium model, no
   output cap) should cost more credits than execution (mini model, capped
   output). Cached runs are free. Keep the hourly `RATE_LIMITS` as abuse
   protection only.
3. **Tiers** (numbers are placeholders until step 1):

   | | Free | Pro |
   |---|---|---|
   | Ideas and buckets | Unlimited | Unlimited |
   | Analysis credits | ~10/month | ~150/month, plus top-ups |
   | Refinement model | Mini | Premium |
   | Buckets per execution run | 5 | 8+ |
   | Version history | Last 3 per bucket | Unlimited |

4. **Build it:**
   - `plan` column on `profiles`.
   - Usage for the billing period is derived from `ai_runs`, weighted by
     route, the same way `isRateLimited` counts runs today.
   - The analyze route returns 402 with an upgrade message when a user is
     out of credits, next to the existing 429 check.
   - The modal shows remaining credits before a run starts.
   - Stripe Checkout, a webhook that sets `plan`, and the Stripe customer
     portal for cancellations.
