# C-ZERO Token — Business Model & Requirements Specification

**Document**: CZM-BRD-001
**Version**: 1.0
**Status**: Draft for Engineering
**Date**: 2026

---

## Part 1 ─ Business Model

### 1.1 Vision

C-ZERO는 **검증된 탄소 감축을 글로벌 자본시장이 직접 거래할 수 있는 디지털 금융자산으로 전환**하는 인프라이다.

> "Carbon is the New Gold."

### 1.2 Value Chain (5단계)

```
폐기물 ──▶ 분해/처리 ──▶ 검증된 탄소권 ──▶ 디지털 자산 (cNFT/ST) ──▶ DeFi/거래소
                            │                       │
                            └─ ACR/Verra/CCP        └─ $CZM utility token
```

| 단계 | 활동 | 주체 | 산출물 |
|---|---|---|---|
| 1. 분해 | 폐냉매·F-Gas·폐타이어 등 처리 | 그린사이언스 (한국) + Local ProjectCo | DRE 측정값 |
| 2. 검증 | VVB 현장 검증 | DNV/SCS/Bureau Veritas | VVB 인증서 |
| 3. 등록 | 국제 등록기관 등록 | 그린사이언스 + ACR/Verra | CCP 라벨 |
| 4. 토큰화 | cNFT 발행, $CZM 가스로 거래 | C-ZERO ADGM Ltd | on-chain 자산 |
| 5. 유통 | DEX/DeFi 거래, 거래소 상장 | C-ZERO ADGM Ltd + 시장 | 자본 회수 |

### 1.3 Revenue Streams (5가지)

| # | 매출원 | 주체 | 비중 (Y10 추정) |
|---|---|---|---|
| 1 | cNFT 매각 (탄소권 직접 판매) | 미국 회사 | ~50% |
| 2 | $CZM 토큰 거래 수수료 | Dubai 회사 | ~15% |
| 3 | DeFi 프로토콜 수수료 (cDEX, cLend) | Dubai 회사 | ~12% |
| 4 | 기술 라이선스 royalty | 한국 회사 | ~10% |
| 5 | EPC + 장비 판매 | 한국 회사 | ~13% |

### 1.4 Stakeholders (3-Company SOTP)

| 회사 | 역할 | 토큰과의 관계 |
|---|---|---|
| **(주)그린사이언스** (한국) | 기술 + 탄소권 + 미국사업 | 매출 → cNFT, royalty → $CZM, IPO/Series A 추진 |
| **C-ZERO ADGM Ltd** (UAE) | $CZM 발행·운영, DeFi | 토큰 issuer, VARA 라이선스 |
| **Planet Earth Corp** (US) | RWA SPV, STO 발행 | C-ZERO ST (증권형 토큰) 발행 |

### 1.5 토큰의 비즈니스적 역할

$CZM은 단순한 "투자 자산"이 아니라 **다음 5가지 기능**을 동시에 수행한다.

1. **Gas / Fee Token** — 모든 cNFT 발행·전송, DeFi 사용 시 가스로 사용
2. **Node 운영 보증금** — Container Node 운영자가 staking해야 mining 가능
3. **거버넌스** — veCZM lock 시 의결권 보유 (Phase 2)
4. **Cashflow asset** — protocol revenue 분배 (97% of price formation)
5. **유동성 layer** — DeFi pool에 투입되어 거래 활성화

---

## Part 2 ─ Token Economic Model

### 2.1 Supply

| 속성 | 값 |
|---|---|
| 총 발행량 | 5,000,000,000 (5B) ─ Hard cap |
| 발행 schedule | 10년에 걸쳐 점진 인도 |
| 소수점 | 18 decimals |
| 표준 | ERC-20 |

### 2.2 Distribution (8 categories)

| 카테고리 | 비율 | 토큰 (M) | Vesting |
|---|---|---|---|
| Mining 보상 | 40% | 2,000 | 10년 선형 |
| DeFi/생태계 | 15% | 750 | 5년 선형 |
| Foundation | 15% | 750 | 1y cliff + 3y vest |
| Partners | 10% | 500 | 2y cliff + 3y vest |
| Strategic (Series A) | 8% | 400 | 6mo cliff + 18mo vest |
| Public (Public sale) | 5% | 250 | 3mo cliff + 12mo vest |
| Airdrop | 4% | 200 | 2y 분할 |
| 마케팅 | 3% | 150 | 4y 분할 |

### 2.3 TGE Pricing (Series A-Heavy 채택)

| Round | 가격 | 수량 | 모금 |
|---|---|---|---|
| Seed | $0.150 | 70M | $10.5M |
| Series A | $0.200 | 130M | $26.0M |
| **Total** | **avg $0.183** | **200M** | **$36.5M (470억원)** |

### 2.4 Staking Yield Mechanism

```
yield_rate(P, pool) = R₀ × (P_TGE / P) × (pool_left / pool_init)
                    ≤ R₀ = 10% / month
                    → 0% / month  (pool 소진 시 자동 종료)
```

- Eligibility: TGE staker만 (whitelist)
- Pool cap: **200M $CZM** (4% of supply)
- Pool 소진 예상 기간: 4-6개월
- 장기 가격 영향: **−1.1%** (시장 noise 이내)

### 2.5 Buyback-and-Burn

- 탄소권 매출의 6%로 시장에서 $CZM 매입 후 영구 소각
- Y10 누적 burn 예상: 970M (총 발행의 19%)

### 2.6 Long-term Price Equilibrium

| 시나리오 | Y10 가격 | 시가총액 | Cohort A (Seed) ROI |
|---|---|---|---|
| Bear | $0.45 | $884M | 4× |
| **Base** | **$1.73** | **$5.0B** | **16×** |
| Bull | $3.49 | $14.4B | 33× |

---

## Part 3 ─ Functional Requirements

### 3.1 FR-1 — Token Core (CZMToken)

| ID | 요구사항 | 우선순위 |
|---|---|---|
| FR-1.1 | ERC-20 표준 준수 (transfer, approve, balanceOf, allowance) | P0 |
| FR-1.2 | 5,000,000,000 hard cap (`ERC20Capped`) | P0 |
| FR-1.3 | Burn 기능 (`ERC20Burnable`) — 사용자 self-burn + Treasury burn | P0 |
| FR-1.4 | Pausable — 비상 시 transfer 일시 중단 | P0 |
| FR-1.5 | Permit (EIP-2612) — gasless approve | P1 |
| FR-1.6 | Role-based access control (MINTER, PAUSER) | P0 |
| FR-1.7 | 잘못 송금된 ERC-20 토큰 회수 (recoverERC20) | P2 |

### 3.2 FR-2 — TGE Sale (CZMTGESale)

| ID | 요구사항 | 우선순위 |
|---|---|---|
| FR-2.1 | Multi-round 지원 (Seed, Series A 등 N개 round) | P0 |
| FR-2.2 | Round별 가격, hardCap, 시작/종료 시각 설정 | P0 |
| FR-2.3 | KYC whitelist (round별 별도 관리) | P0 |
| FR-2.4 | USDC 결제 (USD 환산 6 decimals) | P0 |
| FR-2.5 | Round별 vesting (cliff + linear) 자동 설정 | P0 |
| FR-2.6 | claim 함수 — vested 분만 인출 가능 | P0 |
| FR-2.7 | Hardcap 도달 시 추가 매수 불가 | P0 |
| FR-2.8 | Admin USDC 인출 (재단 운영비 충당) | P0 |
| FR-2.9 | Round 강제 종료 기능 (admin) | P1 |

### 3.3 FR-3 — Vesting (CZMVesting)

| ID | 요구사항 | 우선순위 |
|---|---|---|
| FR-3.1 | Linear vesting with cliff | P0 |
| FR-3.2 | 다수 schedule 동시 관리 (사용자당 N개) | P0 |
| FR-3.3 | release(id) — schedule 단위 인출 | P0 |
| FR-3.4 | releaseAll() — 본인 모든 schedule 일괄 인출 | P1 |
| FR-3.5 | revoke 기능 (Foundation/Partners 등 revocable schedule) | P0 |
| FR-3.6 | revoke 시 vested portion은 beneficiary 인도, 잔여는 admin 환원 | P0 |

### 3.4 FR-4 — Staking (CZMStaking)

| ID | 요구사항 | 우선순위 |
|---|---|---|
| FR-4.1 | Eligibility whitelist 관리 (set/batch) | P0 |
| FR-4.2 | 가격 탄력적 yield rate 계산 (yield ∝ 1/P × pool) | P0 |
| FR-4.3 | 실시간 가격 oracle 연동 | P0 |
| FR-4.4 | yield rate cap = R₀ (10%/mo) | P0 |
| FR-4.5 | Pool 소진 시 자동 yield = 0 | P0 |
| FR-4.6 | stake / unstake / claim — 시점별 reward 자동 정산 | P0 |
| FR-4.7 | pendingReward 조회 (시뮬레이션) | P1 |
| FR-4.8 | 모든 user unstake 후 pool remainder 회수 | P2 |

### 3.5 FR-5 — Burn Mechanism (Treasury)

| ID | 요구사항 | 우선순위 |
|---|---|---|
| FR-5.1 | 외부 Treasury가 시장에서 $CZM 매입 (off-chain 자동화) | P1 |
| FR-5.2 | 매입한 $CZM을 burn() 호출로 영구 소각 | P0 |
| FR-5.3 | burn 이벤트 emit (집계 가능) | P1 |
| FR-5.4 | Treasury는 multisig + Timelock 통제 | P0 |

### 3.6 FR-6 — Future Phase 2 (참고용)

| ID | 요구사항 | 시기 |
|---|---|---|
| FR-6.1 | veCZM (Curve veCRV 방식 4년 lock) | Phase 2 |
| FR-6.2 | cDEX (carbon credit AMM) | Phase 2 |
| FR-6.3 | cLend (cNFT 담보 대출) | Phase 2 |
| FR-6.4 | cBond (Pendle 형 PT/YT 분리) | Phase 2 |
| FR-6.5 | cInsure (mutual insurance pool) | Phase 3 |
| FR-6.6 | cUSD (carbon-collateralized stablecoin) | Phase 3 |

---

## Part 4 ─ Non-Functional Requirements

### 4.1 Security (NFR-SEC)

| ID | 요구사항 |
|---|---|
| NFR-SEC.1 | 외부 감사 1+ 회사 (Trail of Bits / OpenZeppelin / Quantstamp) |
| NFR-SEC.2 | 모든 admin role은 multisig (3-of-5 Gnosis Safe) |
| NFR-SEC.3 | Admin 행위는 48시간 timelock 통과 |
| NFR-SEC.4 | ReentrancyGuard 적용 (stake, unstake, claim, purchase) |
| NFR-SEC.5 | Bug bounty 프로그램 (Immunefi, 최대 $500K) |
| NFR-SEC.6 | Emergency pause 기능 |
| NFR-SEC.7 | Slither / Echidna / Foundry fuzz 테스트 |

### 4.2 Compliance (NFR-COMP)

| ID | 요구사항 |
|---|---|
| NFR-COMP.1 | VARA Cat 4 라이선스 하 운영 (Issuance) |
| NFR-COMP.2 | US persons 매수 차단 (TGE Sale `purchase()` 함수에 KYC oracle 통합) |
| NFR-COMP.3 | OFAC sanctions list 자동 차단 |
| NFR-COMP.4 | KYC 통과 사용자만 TGE/Staking 참여 가능 |
| NFR-COMP.5 | AML 감시 대상 거래 자동 flag (대량 transfer, 의심 패턴) |
| NFR-COMP.6 | Chainalysis / TRM Labs 통합 (이상 거래 모니터링) |

### 4.3 Scalability (NFR-SCALE)

| ID | 요구사항 |
|---|---|
| NFR-SCALE.1 | Primary chain: Base L2 (낮은 gas, Coinbase 친화) |
| NFR-SCALE.2 | Bridge to Ethereum L1 (LayerZero / Wormhole) |
| NFR-SCALE.3 | C-ZERO L3 (DePIN 전용 — Phase 2) |
| NFR-SCALE.4 | TPS: Base L2 ~1000 TPS 기준 충분 |
| NFR-SCALE.5 | Gas 최적화: storage packing, batch operations |

### 4.4 Auditability (NFR-AUDIT)

| ID | 요구사항 |
|---|---|
| NFR-AUDIT.1 | 모든 상태 변경 시 event emit |
| NFR-AUDIT.2 | view 함수로 모든 상태 조회 가능 (totalStaked, poolRemaining, soldTokens 등) |
| NFR-AUDIT.3 | The Graph subgraph 배포 (off-chain indexing) |
| NFR-AUDIT.4 | Dune Analytics dashboard 구축 |
| NFR-AUDIT.5 | BaseScan / Etherscan verify 필수 |

### 4.5 Upgradability (NFR-UPGRADE)

| ID | 요구사항 |
|---|---|
| NFR-UPGRADE.1 | 모든 contract `non-upgradeable` (proxy 패턴 사용 안 함) |
| NFR-UPGRADE.2 | 다음 버전은 새 contract로 deploy + migration tool 제공 |
| NFR-UPGRADE.3 | 사용자 대상 migration 인센티브 (예: 1.05× 토큰) |

---

## Part 5 ─ External Integrations

### 5.1 Price Oracle

**1차 안**: Chainlink Price Feed (CZM/USD)
- TGE 직후에는 자체 Time-Weighted Average Price (TWAP) oracle 사용
- Aggregation: Uniswap V3 + Coinbase Intl + Binance API (3 source 평균)
- Update frequency: 5분
- Fallback: Chainlink가 stale (>1시간) 시 자동 pause

**2차 안**: Custom oracle with multisig confirmation
- 가격 결정자 5명 multisig (각 다른 거래소 대표)
- 매일 1회 가격 commit

### 5.2 KYC Oracle

| Provider | 역할 |
|---|---|
| Sumsub / Persona | KYC + AML screening |
| Chainalysis | sanctions / AML risk 점수 |
| Custom on-chain whitelist | 통과자 주소 등록 |

Workflow: Off-chain KYC → 통과자 → admin이 `setEligible()` / `setWhitelist()` 호출

### 5.3 Carbon Credit Registries

| Registry | 역할 | 통합 방식 |
|---|---|---|
| ACR (American Carbon Registry) | ODS/F-Gas 등록 | API + 수동 검증 |
| Verra VCS | 자연기반·공정 검증 | API |
| ICVCM CCP | Quality label | 인증서 PDF + on-chain hash |

cNFT 발행 시 registry serial number를 metadata에 포함 → on-chain proof.

### 5.4 Multi-chain Bridges

| Bridge | 사용처 |
|---|---|
| LayerZero | Base ↔ Ethereum (메인) |
| Wormhole | Base ↔ Solana (Phase 2) |
| Custom L3 bridge | Base ↔ C-ZERO L3 (Phase 2) |

---

## Part 6 ─ Development Roadmap

### Phase 0 — Pre-TGE (M0~M3)

| Task | Owner |
|---|---|
| 4 contract 개발 (Token/Vesting/Staking/TGESale) | Blockchain dev team |
| Hardhat 테스트 작성 (coverage 95%+) | Blockchain dev team |
| Slither / Echidna fuzz 테스트 | Security team |
| 외부 감사 (Trail of Bits) | External auditor |
| Multisig + Timelock 셋업 | DevOps |
| Price oracle 구축 | Backend team |
| KYC 통합 (Sumsub) | Backend + Compliance |

### Phase 1 — TGE (M3~M6)

| Task | Owner |
|---|---|
| Mainnet deploy (Base) | DevOps |
| Vesting schedule 일괄 생성 | Operations |
| KYC whitelist 등록 | Compliance |
| Seed round open | Sales/IR |
| Series A round open | Sales/IR |
| Public listing (Coinbase Intl, Binance) | BD |
| Staking pool 가동 | Operations |

### Phase 2 — DeFi (M6~M18)

| Task | Owner |
|---|---|
| veCZM contract 개발·감사·deploy | Blockchain dev team |
| cDEX 개발 (Uniswap V4 hook) | DeFi team |
| cLend 개발 | DeFi team |
| cBond 개발 (Pendle 형) | DeFi team |
| LayerZero bridge to Ethereum | Infrastructure |
| The Graph subgraph | Data team |

### Phase 3 — Scale (M18~)

| Task | Owner |
|---|---|
| C-ZERO L3 deploy (App-specific rollup) | Infrastructure |
| cInsure | DeFi team |
| cUSD stablecoin (carbon-collateralized) | DeFi team |
| Cross-chain expansion (Solana, Arbitrum) | Infrastructure |
| Governance contract (CZMGovernor) | Blockchain dev team |

---

## Part 7 ─ Acceptance Criteria

### 7.1 Code Quality

- Solidity ^0.8.20
- Lint: solhint + prettier (zero warnings)
- Test coverage: ≥ 95% (statements, branches)
- Gas optimization: 모든 함수의 gas usage 측정·문서화

### 7.2 Security Audit

- 외부 감사 보고서에 critical/high 이슈 0건
- medium 이슈는 mitigation 명시 + 해결
- low/informational 이슈는 검토 후 수용 또는 거부 명문화

### 7.3 Functional Tests

| 테스트 항목 | 통과 기준 |
|---|---|
| 5B hard cap | 초과 mint 시 revert |
| Pause 시 transfer | revert |
| Vesting cliff 전 | release = 0 |
| Vesting cliff 후 | 시간 비례 release |
| Vesting revoke | vested 인도 + 잔여 환원 |
| Staking yield (P=P_TGE) | rate = 10% (cap) |
| Staking yield (P=2×P_TGE) | rate = 5% (1/2) |
| Pool 소진 | rate = 0 |
| Non-eligible stake | revert |
| TGE round | hardcap 준수, 시간 외 매수 revert |
| TGE claim | cliff 전 0, vest 비율대로 |

### 7.4 Performance Benchmarks

| 함수 | 목표 gas |
|---|---|
| `transfer` | < 60K gas |
| `purchase` (TGE) | < 200K gas |
| `stake` | < 150K gas |
| `claim` (vesting) | < 100K gas |

### 7.5 Compliance Sign-off

- [ ] VARA 라이선스 Cat 4 보유
- [ ] US persons 차단 KYC 작동 확인
- [ ] OFAC list 자동 차단 검증
- [ ] AML 감시 시스템 가동
- [ ] 외부 법무 의견서 (UAE + 한국 + US Reg S 준수)

---

## Part 8 ─ Risk Register

| 위험 | 가능성 | 영향 | 대응 |
|---|---|---|---|
| Smart contract 버그 | 중 | 치명적 | 외부 감사 + bug bounty + non-upgradeable |
| Oracle 조작 | 중 | 큼 | 다중 source + TWAP + Chainlink fallback |
| 규제 변경 (VARA, SEC) | 중 | 큼 | 외부 법무팀 상시 모니터링 + 여러 jurisdiction 분산 |
| US persons 우회 매수 | 낮음 | 중 | OFAC + IP block + KYC 강화 |
| Pool 조기 소진 | 낮음 | 작음 | Pool 사용량 monitoring + 필요 시 추가 자금 |
| Bridge 해킹 | 중 | 큼 | LayerZero 감사 검증 + 한도 설정 |

---

## Part 9 ─ Glossary

| 용어 | 정의 |
|---|---|
| $CZM | C-ZERO Mining Token (utility) |
| cNFT | Carbon Credit NFT (1톤 = 1 NFT) |
| C-ZERO ST | C-ZERO Security Token (Reg D 506(c)) |
| Cohort A | TGE 시점 staker 그룹 |
| DePIN | Decentralized Physical Infrastructure Network |
| DRE | Destruction Removal Efficiency |
| FDV | Fully Diluted Valuation |
| ICVCM CCP | Integrity Council for the Voluntary Carbon Market — Core Carbon Principles |
| MRV | Measurement, Reporting, Verification |
| TGE | Token Generation Event |
| veCZM | vote-escrowed CZM (4년 lock) |
| VVB | Validation/Verification Body (DNV/SCS/Bureau Veritas 등) |

---

## Part 10 ─ Document Control

| 항목 | 내용 |
|---|---|
| 작성자 | C-ZERO Engineering Team |
| 검토자 | (주)그린사이언스 + C-ZERO ADGM 발기인 |
| 승인자 | Founders' Committee |
| 다음 리뷰 | TGE 2주 전 |
| 변경 절차 | PR + 양 당사자 서명 |

---

## 부록 A ─ Quick Reference

### A.1 핵심 숫자
- 총 발행량: 5B / 18 decimals
- TGE 판매: 200M @ avg $0.183 → $36.5M
- Staking pool: 200M (4% of supply)
- Y10 base price: $1.73 (11.5× 상승)
- Cohort A ROI (Seed): 16×

### A.2 핵심 비율
- Mining 보상: 40% (10년 vesting)
- 사용자/생태계 분배: 60%+
- 회사 측 분배: ≤ 25%
- 자본 조달: ≤ 13%
- Buyback-burn rate: 6% of carbon revenue
- Lock-up at maturity: 65% (veCZM 45% + Stake 20%)

### A.3 핵심 timing
- Seed cliff: 12개월
- Series A cliff: 6개월
- Foundation cliff: 12개월
- Partners cliff: 24개월
- Staking pool 소진 예상: 4-6개월
