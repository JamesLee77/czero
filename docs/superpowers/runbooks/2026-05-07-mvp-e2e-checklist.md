# MVP E2E walkthrough — Phase 1 testnet

Pre-conditions:
- Backend Worker deployed at https://czero-portal-api.misterylee.workers.dev
- Frontend deployed at https://czero-portal.pages.dev with `VITE_API_BASE_URL` baked in
- D1 database `czero-portal-db` migrated remotely
- Resend API key configured (replace placeholder before mass-emailing)

## 1. Wallet connection
- [ ] Open https://czero-portal.pages.dev
- [ ] Click Connect → choose MetaMask → approve
- [ ] Network auto-switches to Base Sepolia
- [ ] Header shows shortened address

## 2. Sign-in with Ethereum
- [ ] Open `/settings`
- [ ] Click "Sign in with Ethereum"
- [ ] Wallet prompts message — sign it
- [ ] Page rerenders showing "Wallet" + "Email notifications" sections

## 3. Email subscription + verification
- [ ] Enter a real inbox email → click Subscribe
- [ ] Verify email arrives within 1 minute (subject: "Verify your C-ZERO portal email")
- [ ] Click the verification link → redirects to `/settings?emailVerified=ok`
- [ ] Settings page shows "✓ Verified"

## 4. Vesting view
- [ ] Onboard a test investor by running an existing onboarding script (e.g.,
      `scripts/simulate-presale.ts`) or by calling `CZMVesting.createSchedule(...)`
      directly via BaseScan Write Contract
- [ ] On `/vesting`, the schedule appears with progress bar at 0%
- [ ] Wait until cliff passes → "Releasable now" shows a non-zero amount
- [ ] Click "Release X CZM" → wallet prompts → confirm
- [ ] Page rerenders; releasable drops, released increases

## 5. Email notifications via cron
- [ ] Manually trigger cron:
      ```
      curl https://czero-portal-api.misterylee.workers.dev/__scheduled?cron=0+%2A+%2A+%2A+%2A
      ```
- [ ] Verify "claim_ready" email arrives (only if releasable > 0)
- [ ] Trigger again → no duplicate (dedupe works)

## 6. Migrate page (sanity)
- [ ] Visit `/migrate` — page loads without errors
- [ ] Approval / Migrate buttons gated as expected based on v1 balance

## 7. Logout
- [ ] Settings → Disconnect → reload page → Settings shows the SIWE prompt again

## 8. Mobile responsive sanity
- [ ] Resize browser to 375px width — layout reflows; no horizontal scroll
- [ ] Dashboard cards stack to single column
- [ ] Settings sections remain readable

## 9. Production smoke checks (every redeploy)
- [ ] `curl -i https://czero-portal-api.misterylee.workers.dev/health` returns 200
- [ ] `curl -I https://czero-portal.pages.dev` returns 200
- [ ] BaseScan still shows the four contract addresses verified
