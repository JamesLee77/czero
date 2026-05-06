# C-ZERO Token — Business Model & Requirements Specification

**Document**: CZM-BRD-001
**Version**: 1.0
**Status**: Draft for Engineering
**Date**: 2026

---

## Part 1 ─ Business Model

### 1.1 Vision

C-ZERO is the infrastructure that **converts verified carbon reductions into a digital financial asset that global capital markets can trade directly**.

> "Carbon is the New Gold."

### 1.2 Value chain (5 stages)

```
Waste ──▶ Decomposition/treatment ──▶ Verified carbon credits ──▶ Digital assets (cNFT/ST) ──▶ DeFi/exchanges
                                          │                                │
                                          └─ ACR/Verra/CCP                 └─ $CZM utility token
```

| Stage | Activity | Actor | Output |
|---|---|---|---|
| 1. Decomposition | Treatment of waste refrigerants, F-gas, used tyres, etc. | GreenScience (Korea) + local ProjectCo | DRE measurements |
| 2. Verification | On-site VVB verification | DNV / SCS / Bureau Veritas | VVB certificate |
| 3. Registration | Registration with international registry | GreenScience + ACR/Verra | CCP label |
| 4. Tokenisation | cNFT issuance, $CZM as gas | C-ZERO ADGM Ltd | On-chain assets |
| 5. Distribution | DEX/DeFi trading, exchange listing | C-ZERO ADGM Ltd + market | Capital recovery |

### 1.3 Revenue streams (5)

| # | Source | Operator | Share (Y10 est.) |
|---|---|---|---|
| 1 | cNFT sales (direct carbon credit sale) | US company | ~50% |
| 2 | $CZM token transaction fees | Dubai company | ~15% |
| 3 | DeFi protocol fees (cDEX, cLend) | Dubai company | ~12% |
| 4 | Technology license royalty | Korean company | ~10% |
| 5 | EPC + equipment sales | Korean company | ~13% |

### 1.4 Stakeholders (3-Company SOTP)

| Company | Role | Token relationship |
|---|---|---|
| **GreenScience Co., Ltd.** (Korea) | Technology + carbon credits + US business | Revenue → cNFT, royalty → $CZM, IPO/Series A planned |
| **C-ZERO ADGM Ltd** (UAE) | $CZM issuance/operation, DeFi | Token issuer, VARA-licensed |
| **Planet Earth Corp** (US) | RWA SPV, STO issuance | Issuer of C-ZERO ST (security token) |

### 1.5 Token's business roles

$CZM is not just an "investment asset"; it simultaneously plays **5 roles**:

1. **Gas / Fee token** — used for gas in cNFT issuance/transfer and DeFi
2. **Node operator collateral** — Container Node operators must stake to mine
3. **Governance** — voting power when locked into veCZM (Phase 2)
4. **Cashflow asset** — protocol revenue distributed to holders (97% of price formation)
5. **Liquidity layer** — supplied to DeFi pools to drive trading

---

## Part 2 ─ Token Economic Model

### 2.1 Supply

| Property | Value |
|---|---|
| Total supply | 5,000,000,000 (5B) — Hard cap |
| Distribution schedule | Released gradually over 10 years |
| Decimals | 18 |
| Standard | ERC-20 |

### 2.2 Distribution (8 categories)

| Category | Share | Tokens (M) | Vesting |
|---|---|---|---|
| Mining rewards | 40% | 2,000 | Linear over 10 years |
| DeFi / ecosystem | 15% | 750 | Linear over 5 years |
| Foundation | 15% | 750 | 1y cliff + 3y vest |
| Partners | 10% | 500 | 2y cliff + 3y vest |
| Strategic (Series A) | 8% | 400 | 6mo cliff + 18mo vest |
| Public (public sale) | 5% | 250 | 3mo cliff + 12mo vest |
| Airdrop | 4% | 200 | Distributed over 2 years |
| Marketing | 3% | 150 | Distributed over 4 years |

### 2.3 TGE pricing (Series A-Heavy)

| Round | Price | Quantity | Raise |
|---|---|---|---|
| Seed | $0.150 | 70M | $10.5M |
| Series A | $0.200 | 130M | $26.0M |
| **Total** | **avg $0.183** | **200M** | **$36.5M (~₩47B)** |

### 2.4 Staking yield mechanism

```
yield_rate(P, pool) = R₀ × (P_TGE / P) × (pool_left / pool_init)
                    ≤ R₀ = 10% / month
                    → 0% / month  (auto-stops when pool is exhausted)
```

- Eligibility: TGE stakers only (whitelist)
- Pool cap: **200M $CZM** (4% of supply)
- Estimated time to drain pool: 4-6 months
- Long-term price impact: **-1.1%** (within market noise)

### 2.5 Buyback-and-burn

- 6% of carbon credit revenue used to buy $CZM on the market and permanently burn
- Y10 cumulative burn estimate: 970M (19% of total supply)

### 2.6 Long-term price equilibrium

| Scenario | Y10 price | Market cap | Cohort A (Seed) ROI |
|---|---|---|---|
| Bear | $0.45 | $884M | 4× |
| **Base** | **$1.73** | **$5.0B** | **16×** |
| Bull | $3.49 | $14.4B | 33× |

---

## Part 3 ─ Functional Requirements

### 3.1 FR-1 — Token core (CZMToken)

| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | ERC-20 standard compliance (transfer, approve, balanceOf, allowance) | P0 |
| FR-1.2 | 5,000,000,000 hard cap (`ERC20Capped`) | P0 |
| FR-1.3 | Burn (`ERC20Burnable`) — user self-burn + treasury burn | P0 |
| FR-1.4 | Pausable — emergency transfer halt | P0 |
| FR-1.5 | Permit (EIP-2612) — gasless approve | P1 |
| FR-1.6 | Role-based access control (MINTER, PAUSER) | P0 |
| FR-1.7 | Recovery of mistakenly-sent ERC-20 tokens (recoverERC20) | P2 |

### 3.2 FR-2 — TGE Sale (CZMTGESale)

| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | Multi-round support (Seed, Series A, etc.) | P0 |
| FR-2.2 | Per-round price, hardCap, start/end timestamps | P0 |
| FR-2.3 | KYC whitelist (per-round) | P0 |
| FR-2.4 | USDC payment (USD-equivalent, 6 decimals) | P0 |
| FR-2.5 | Per-round vesting (cliff + linear) auto-applied | P0 |
| FR-2.6 | claim function — only vested portion claimable | P0 |
| FR-2.7 | Hardcap reached → no more purchases | P0 |
| FR-2.8 | Admin USDC withdrawal (cover foundation opex) | P0 |
| FR-2.9 | Force-close round (admin) | P1 |

### 3.3 FR-3 — Vesting (CZMVesting)

| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | Linear vesting with cliff | P0 |
| FR-3.2 | Multiple schedules per user | P0 |
| FR-3.3 | release(id) — per-schedule withdrawal | P0 |
| FR-3.4 | releaseAll() — release all of caller's schedules | P1 |
| FR-3.5 | revoke (Foundation/Partners and other revocable schedules) | P0 |
| FR-3.6 | revoke pays vested portion to beneficiary, returns remainder to admin | P0 |

### 3.4 FR-4 — Staking (CZMStaking)

| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | Eligibility whitelist management (set/batch) | P0 |
| FR-4.2 | Price-elastic yield rate calculation (yield ∝ 1/P × pool) | P0 |
| FR-4.3 | Real-time price oracle integration | P0 |
| FR-4.4 | Yield rate cap = R₀ (10%/mo) | P0 |
| FR-4.5 | Pool exhausted → yield = 0 | P0 |
| FR-4.6 | stake / unstake / claim — auto-settle reward | P0 |
| FR-4.7 | pendingReward query (simulation) | P1 |
| FR-4.8 | Recover pool remainder once all users have unstaked | P2 |

### 3.5 FR-5 — Burn mechanism (Treasury)

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | External Treasury buys $CZM on the market (off-chain automation) | P1 |
| FR-5.2 | Treasury calls burn() to permanently destroy purchased $CZM | P0 |
| FR-5.3 | Burn event emitted (aggregable) | P1 |
| FR-5.4 | Treasury controlled by multisig + Timelock | P0 |

### 3.6 FR-6 — Future Phase 2 (reference)

| ID | Requirement | Phase |
|---|---|---|
| FR-6.1 | veCZM (Curve veCRV-style 4-year lock) | Phase 2 |
| FR-6.2 | cDEX (carbon credit AMM) | Phase 2 |
| FR-6.3 | cLend (cNFT collateralised lending) | Phase 2 |
| FR-6.4 | cBond (Pendle-style PT/YT split) | Phase 2 |
| FR-6.5 | cInsure (mutual insurance pool) | Phase 3 |
| FR-6.6 | cUSD (carbon-collateralised stablecoin) | Phase 3 |

---

## Part 4 ─ Non-Functional Requirements

### 4.1 Security (NFR-SEC)

| ID | Requirement |
|---|---|
| NFR-SEC.1 | At least one external audit (Trail of Bits / OpenZeppelin / Quantstamp) |
| NFR-SEC.2 | All admin roles assigned to a multisig (3-of-5 Gnosis Safe) |
| NFR-SEC.3 | Admin actions gated by 48-hour timelock |
| NFR-SEC.4 | ReentrancyGuard applied (stake, unstake, claim, purchase) |
| NFR-SEC.5 | Bug bounty program (Immunefi, max $500K) |
| NFR-SEC.6 | Emergency pause |
| NFR-SEC.7 | Slither / Echidna / Foundry fuzz tests |

### 4.2 Compliance (NFR-COMP)

| ID | Requirement |
|---|---|
| NFR-COMP.1 | Operate under VARA Cat 4 license (issuance) |
| NFR-COMP.2 | Block US persons from buying (TGE Sale `purchase()` integrates KYC oracle) |
| NFR-COMP.3 | Automatic OFAC sanctions list block |
| NFR-COMP.4 | Only KYC-approved users may participate in TGE/Staking |
| NFR-COMP.5 | Auto-flag AML-monitored transactions (large transfers, suspicious patterns) |
| NFR-COMP.6 | Chainalysis / TRM Labs integration for anomalous activity monitoring |

### 4.3 Scalability (NFR-SCALE)

| ID | Requirement |
|---|---|
| NFR-SCALE.1 | Primary chain: Base L2 (low gas, Coinbase-friendly) |
| NFR-SCALE.2 | Bridge to Ethereum L1 (LayerZero / Wormhole) |
| NFR-SCALE.3 | C-ZERO L3 (DePIN-dedicated — Phase 2) |
| NFR-SCALE.4 | TPS: Base L2 ~1000 TPS is sufficient |
| NFR-SCALE.5 | Gas optimisation: storage packing, batch operations |

### 4.4 Auditability (NFR-AUDIT)

| ID | Requirement |
|---|---|
| NFR-AUDIT.1 | Emit events on every state change |
| NFR-AUDIT.2 | All state queryable via view functions (totalStaked, poolRemaining, soldTokens, etc.) |
| NFR-AUDIT.3 | The Graph subgraph deployed (off-chain indexing) |
| NFR-AUDIT.4 | Dune Analytics dashboard |
| NFR-AUDIT.5 | BaseScan / Etherscan verify required |

### 4.5 Upgradability (NFR-UPGRADE)

| ID | Requirement |
|---|---|
| NFR-UPGRADE.1 | Every contract `non-upgradeable` (no proxy pattern) |
| NFR-UPGRADE.2 | Next version deployed as a new contract + migration tool |
| NFR-UPGRADE.3 | Migration incentive for users (e.g. 1.05× tokens) |

---

## Part 5 ─ External Integrations

### 5.1 Price Oracle

**Primary**: Chainlink Price Feed (CZM/USD)
- Use a self-hosted Time-Weighted Average Price (TWAP) oracle right after TGE
- Aggregation: Uniswap V3 + Coinbase International + Binance API (3-source average)
- Update frequency: 5 minutes
- Fallback: auto-pause if Chainlink feed becomes stale (>1 hour)

**Secondary**: Custom oracle with multisig confirmation
- 5-of-N price multisig (representatives from different exchanges)
- One price commit per day

### 5.2 KYC Oracle

| Provider | Role |
|---|---|
| Sumsub / Persona | KYC + AML screening |
| Chainalysis | Sanctions / AML risk scoring |
| Custom on-chain whitelist | Register approved addresses |

Workflow: off-chain KYC → approved → admin calls `setEligible()` / `setWhitelist()`

### 5.3 Carbon Credit Registries

| Registry | Role | Integration |
|---|---|---|
| ACR (American Carbon Registry) | ODS / F-Gas registration | API + manual verification |
| Verra VCS | Nature-based / process verification | API |
| ICVCM CCP | Quality label | Certificate PDF + on-chain hash |

When issuing a cNFT, the registry's serial number is included in metadata → on-chain proof.

### 5.4 Multi-chain bridges

| Bridge | Use |
|---|---|
| LayerZero | Base ↔ Ethereum (primary) |
| Wormhole | Base ↔ Solana (Phase 2) |
| Custom L3 bridge | Base ↔ C-ZERO L3 (Phase 2) |

---

## Part 6 ─ Development Roadmap

### Phase 0 — Pre-TGE (M0~M3)

| Task | Owner |
|---|---|
| Develop 4 contracts (Token/Vesting/Staking/TGESale) | Blockchain dev team |
| Write Hardhat tests (95%+ coverage) | Blockchain dev team |
| Slither / Echidna fuzz tests | Security team |
| External audit (Trail of Bits) | External auditor |
| Multisig + Timelock setup | DevOps |
| Build price oracle | Backend team |
| KYC integration (Sumsub) | Backend + Compliance |

### Phase 1 — TGE (M3~M6)

| Task | Owner |
|---|---|
| Mainnet deploy (Base) | DevOps |
| Bulk-create vesting schedules | Operations |
| Register KYC whitelist | Compliance |
| Open Seed round | Sales / IR |
| Open Series A round | Sales / IR |
| Public listing (Coinbase International, Binance) | BD |
| Activate staking pool | Operations |

### Phase 2 — DeFi (M6~M18)

| Task | Owner |
|---|---|
| Develop / audit / deploy veCZM | Blockchain dev team |
| Develop cDEX (Uniswap V4 hook) | DeFi team |
| Develop cLend | DeFi team |
| Develop cBond (Pendle-style) | DeFi team |
| LayerZero bridge to Ethereum | Infrastructure |
| The Graph subgraph | Data team |

### Phase 3 — Scale (M18~)

| Task | Owner |
|---|---|
| Deploy C-ZERO L3 (app-specific rollup) | Infrastructure |
| cInsure | DeFi team |
| cUSD stablecoin (carbon-collateralised) | DeFi team |
| Cross-chain expansion (Solana, Arbitrum) | Infrastructure |
| Governance contract (CZMGovernor) | Blockchain dev team |

---

## Part 7 ─ Acceptance Criteria

### 7.1 Code Quality

- Solidity ^0.8.20
- Lint: solhint + prettier (zero warnings)
- Test coverage: ≥ 95% (statements, branches)
- Gas optimisation: gas usage measured and documented per function

### 7.2 Security audit

- 0 critical/high findings in the external audit report
- Medium findings have explicit mitigations + are resolved
- Low/informational findings are reviewed and explicitly accepted or rejected

### 7.3 Functional tests

| Test | Pass criterion |
|---|---|
| 5B hard cap | Mint above the cap reverts |
| Pause + transfer | Reverts |
| Vesting cliff (before) | release = 0 |
| Vesting cliff (after) | release proportional to time |
| Vesting revoke | Vested paid + remainder returned |
| Staking yield (P=P_TGE) | rate = 10% (cap) |
| Staking yield (P=2×P_TGE) | rate = 5% (1/2) |
| Pool exhausted | rate = 0 |
| Non-eligible stake | Reverts |
| TGE round | hardcap respected, out-of-window purchases revert |
| TGE claim | 0 before cliff, then proportional vest |

### 7.4 Performance benchmarks

| Function | Target gas |
|---|---|
| `transfer` | < 60K gas |
| `purchase` (TGE) | < 200K gas |
| `stake` | < 150K gas |
| `claim` (vesting) | < 100K gas |

### 7.5 Compliance sign-off

- [ ] VARA Cat 4 licence held
- [ ] US-persons-block KYC verified working
- [ ] OFAC list auto-block verified
- [ ] AML monitoring system operational
- [ ] External legal opinion (UAE + Korea + US Reg S compliance)

---

## Part 8 ─ Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Smart contract bug | Med | Critical | External audit + bug bounty + non-upgradeable |
| Oracle manipulation | Med | High | Multi-source + TWAP + Chainlink fallback |
| Regulatory change (VARA, SEC) | Med | High | External legal monitoring + multi-jurisdiction diversification |
| US persons bypassing the block | Low | Med | OFAC + IP block + reinforced KYC |
| Pool drains too early | Low | Low | Monitor pool usage + add funds if needed |
| Bridge hack | Med | High | Use audited LayerZero + transfer limits |

---

## Part 9 ─ Glossary

| Term | Definition |
|---|---|
| $CZM | C-ZERO Mining Token (utility) |
| cNFT | Carbon Credit NFT (1 ton = 1 NFT) |
| C-ZERO ST | C-ZERO Security Token (Reg D 506(c)) |
| Cohort A | TGE-time staker group |
| DePIN | Decentralised Physical Infrastructure Network |
| DRE | Destruction Removal Efficiency |
| FDV | Fully Diluted Valuation |
| ICVCM CCP | Integrity Council for the Voluntary Carbon Market — Core Carbon Principles |
| MRV | Measurement, Reporting, Verification |
| TGE | Token Generation Event |
| veCZM | vote-escrowed CZM (4-year lock) |
| VVB | Validation/Verification Body (DNV / SCS / Bureau Veritas, etc.) |

---

## Part 10 ─ Document Control

| Item | Content |
|---|---|
| Author | C-ZERO Engineering Team |
| Reviewers | GreenScience Co. + C-ZERO ADGM founders |
| Approver | Founders' Committee |
| Next review | 2 weeks before TGE |
| Change procedure | PR + signature from both parties |

---

## Appendix A ─ Quick reference

### A.1 Key numbers
- Total supply: 5B / 18 decimals
- TGE sale: 200M @ avg $0.183 → $36.5M
- Staking pool: 200M (4% of supply)
- Y10 base price: $1.73 (11.5× appreciation)
- Cohort A ROI (Seed): 16×

### A.2 Key ratios
- Mining rewards: 40% (10-year vesting)
- User/ecosystem allocation: 60%+
- Company allocation: ≤ 25%
- Capital raise: ≤ 13%
- Buyback-burn rate: 6% of carbon revenue
- Lock-up at maturity: 65% (veCZM 45% + Stake 20%)

### A.3 Key timing
- Seed cliff: 12 months
- Series A cliff: 6 months
- Foundation cliff: 12 months
- Partners cliff: 24 months
- Expected staking pool drain: 4-6 months
