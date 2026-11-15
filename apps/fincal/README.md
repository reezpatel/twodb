# Fincal

Personal finance, **per space**. Every space is an isolated book (own accounts, budgets, investments, goals); every
member of the workspace sees every space and has full access (no per-space roles). Spaces come from the control-plane
registry (`/registry/spaces`), like TwoPlan.

- Backend: Fastify + Kysely, schema `fincal`, port 6419. Endpoints: `ENDPOINTS.md` (generated, `pnpm gen:docs`).
- Webapp: Vite on 6519 (`pnpm --filter @twodb/app-fincal-webapp dev`), proxies `/fincal-api` → gateway `/apps/fincal`.
- Dev: `pnpm --filter @twodb/app-twodb provision:dev fincal` → paste `FINCAL_PROVISION_TOKEN` into `.env`, run the gateway,
  then `pnpm --filter @twodb/app-fincal dev`.

## Features
- **Accounts**: bank, cash, UPI, wallet, credit cards (limit, utilisation, statement/due day, "pay bill" = transfer).
- **Transactions**: expense / income / transfer, categories, payee, payment method (UPI/card/cash/…), tags, notes, CSV export.
- **Budgets** (monthly per category) and **envelopes** (allocate, release, move, monthly fill; tag expenses to spend from one).
- **Goals** with target dates and required monthly saving.
- **Investments**: stocks, ETFs, mutual funds, gold/silver/platinum, FDs, RDs, bonds, PPF/EPF/NPS, crypto, real estate.
  FD/RD valued from terms (rate, compounding, dates); priced assets use quantity × manual price with buy/sell (weighted avg cost).
  **No live quotes** — prices/NAVs are entered by hand (bulk "Update prices").
- **Net worth** (live + daily snapshots, 12-month cash trend, target progress) incl. loans.
- **Retirement planner** (server-side projection, what-if, required saving).
- **Analytics**: monthly trend, category breakdown/trend, method/account split, payees, recurring, 3-month forecast.
- **Calculators** (client-side): EMI (+prepayment), SIP (+step-up), lumpsum, FD, RD, goal, SWP, FIRE, CAGR, inflation, card payoff, PPF.

Not included: live market data, bank/UPI import, recurring-transaction automation, multi-currency conversion, per-user permissions.
