# C-ZERO Utility Token ($CZM) Design Document

**Version**: 1.0
**Standard**: ERC-20 (Ethereum L1 / Base L2)
**License**: MIT

---

## 1. Token Overview

| 속성 | 값 |
|---|---|
| **이름** | C-ZERO Mining Token |
| **심볼** | CZM (또는 $CZM) |
| **표준** | ERC-20 (with extensions) |
| **소수점** | 18 decimals |
| **총 발행량** | 5,000,000,000 (5B) — Hard cap |
| **체인** | Base L2 (primary) + Ethereum L1 (bridge) |
| **발행자** | C-ZERO ADGM Ltd (VARA 라이선스) |
| **target audience** | Non-US persons (geo-blocked) |

---

## 2. Distribution

| 카테고리 | 비율 | 토큰 (M) | Vesting | 용도 |
|---|---|---|---|---|
| Mining 보상 (DePIN) | 40% | 2,000 | 10년 선형 | Container Node 운영자 보상 |
| DeFi / 생태계 | 15% | 750 | 5년 선형 | Liquidity, incentives |
| Foundation | 15% | 750 | 1yr cliff + 3yr | 재단 운영, R&D |
| Partners | 10% | 500 | 2yr cliff + 3yr | 전략적 파트너 |
| **Strategic (TGE 일부)** | **8%** | **400** | **6mo lock + 24mo vest** | **Series A** |
| **Public (TGE 일부)** | **5%** | **250** | **3mo lock + 12mo vest** | **Public sale** |
| Airdrop | 4% | 200 | 2년 분할 | 커뮤니티 인센티브 |
| 마케팅 | 3% | 150 | 4년 분할 | 마케팅, 운영비 |

**TGE 판매분**: Strategic 200M + Public 0M = **200M (4% of supply)** at avg $0.183 → **$36.5M raise**

---

## 3. Token Mechanisms

### 3.1 ERC-20 Base
표준 ERC-20 기능: `transfer`, `approve`, `balanceOf` 등. 추가로:
- **Burnable** (`ERC20Burnable`) — 사용자 또는 Treasury가 토큰 소각 가능
- **Capped** (`ERC20Capped`) — 5B 하드캡, 추가 발행 불가
- **Pausable** — 비상 시 전송 일시 중단 (governance 통제)
- **AccessControl** — `MINTER_ROLE`, `PAUSER_ROLE`, `BURNER_ROLE` 분리

### 3.2 Multi-tier TGE Sale (`CZMTGESale.sol`)
- 2-tier pricing: Seed ($0.15) / Series A ($0.20)
- KYC whitelist (eligible 투자자만)
- Round별 lock-up 자동 적용
- USD/USDC/ETH 결제

### 3.3 Vesting (`CZMVesting.sol`)
- Linear vesting with cliff
- Per-allocation 별도 vesting schedule
- Revoke 기능 (해당 카테고리만, governance 통제)

### 3.4 Early-Investor Staking (`CZMStaking.sol`)
**핵심 메커니즘** — 가격 탄력적 yield 자동 감속

```
yield_rate(P, pool) = R₀ × (P_TGE/P) × (pool_left/pool_init)
                    ≤ R₀ = 10%/month (cap)
```

- Eligibility: TGE staker만 (whitelist)
- Pool cap: **200M $CZM** (4% of supply, Foundation pool에서 출자)
- Continuous decay (no floor) → pool 소진 시 yield → 0
- 자동 sunset: 4-6개월 만에 pool 소진

### 3.5 Buyback-and-Burn (Treasury, off-chain or on-chain)
- 탄소권 매출의 6%로 시장에서 $CZM 매입
- 매입한 $CZM은 영구 소각 (burn)
- Y10 누적 burn: ~970M (총 발행의 19%)

### 3.6 veCZM (Future — Phase 2)
Curve veCRV 방식의 vote-escrowed lock:
- Lock 기간: 1주 ~ 4년
- voting power = staked_amount × time_to_unlock / max_time
- veCZM holder는 protocol revenue 분배 받음 (cashflow asset)
- *Phase 2에서 별도 contract로 deploy*

---

## 4. Smart Contract Architecture

```
┌──────────────────────────────────────────────────┐
│                  CZMToken.sol                    │
│   ERC20 + Capped + Burnable + Pausable + AC      │
│              (5B hard cap)                       │
└──────────────────────────────────────────────────┘
              ↑                       ↑
              │ mint()                │ burn()
              │                       │
   ┌──────────┴──────────┐  ┌─────────┴──────────┐
   │  CZMVesting.sol     │  │  CZMStaking.sol    │
   │  ─ Foundation       │  │  ─ Early investors │
   │  ─ Partners         │  │  ─ Yield decay     │
   │  ─ Strategic        │  │  ─ 200M cap        │
   │  ─ Public           │  └────────────────────┘
   │  ─ Airdrop          │
   │  ─ Marketing        │
   └─────────────────────┘
              ↑
              │ deposit()
              │
   ┌──────────┴──────────┐
   │   CZMTGESale.sol    │
   │   ─ Seed @ $0.15    │
   │   ─ Series A @ $0.20│
   │   ─ KYC whitelist   │
   └─────────────────────┘
```

---

## 5. Deployment Plan

### Phase 0 (TGE 직전)
1. `CZMToken` 배포 → 소유자에게 5B 전체 mint
2. `CZMVesting` 배포 → 각 카테고리별 vesting schedule 생성
3. `CZMStaking` 배포 → 200M Pool 자금 transfer
4. `CZMTGESale` 배포 → Seed 70M + Series A 130M 자금 transfer

### Phase 1 (TGE)
1. Seed round 시작 → KYC 통과자 매수
2. Series A round 시작 → KYC 통과자 매수
3. Public listing (Coinbase Intl, Binance)

### Phase 2 (TGE + 6mo)
1. Staking pool 소진 → emission 자동 종료
2. veCZM 배포 (별도)
3. DeFi primitives 배포 (cDEX, cLend, cBond)

### Phase 3 (TGE + 12mo+)
1. Buyback-burn Treasury 가동
2. Cross-chain bridge (L1 ↔ L2)
3. Governance contract (CZMGovernor)

---

## 6. Security Considerations

### 6.1 Audits
- 외부 감사 (Trail of Bits / OpenZeppelin / Quantstamp)
- TGE 전 monthly bug bounty (Immunefi)

### 6.2 Access Control
- `DEFAULT_ADMIN_ROLE`: Multisig (3-of-5)
- `MINTER_ROLE`: TGESale + Vesting (revocable)
- `PAUSER_ROLE`: Multisig only
- 모든 admin 행위는 `Timelock` (48시간)을 거쳐야 함

### 6.3 Emergency Procedures
- `pause()` — 비상 시 전송 일시 중단
- `recoverERC20()` — 잘못 전송된 토큰 회수
- Upgrade pattern: 모든 contract `non-upgradeable` (사용자 신뢰 확보) — 다음 버전은 새 contract로 migration

### 6.4 Compliance
- **US Geo-blocking**: TGE Sale의 `purchase()` 함수에서 KYC oracle 통해 IP/국적 확인
- **VARA / SEC Reg S 준수**: $CZM은 utility token으로 분류, US persons 매수 차단
- **Sanctions screening**: OFAC list 자동 차단

---

## 7. Files

| 파일 | 설명 |
|---|---|
| `CZMToken.sol` | ERC-20 메인 토큰 |
| `CZMVesting.sol` | Linear vesting with cliff |
| `CZMStaking.sol` | 가격 탄력적 yield staking pool |
| `CZMTGESale.sol` | Multi-tier TGE 판매 |
| `CZM_Token_Design.md` | 본 설계 문서 |

---

## 8. Standards & References

- ERC-20: https://eips.ethereum.org/EIPS/eip-20
- ERC-2612 (Permit): gasless approve
- OpenZeppelin Contracts v5.0
- Curve veCRV (https://curve.readthedocs.io/dao-vecrv.html) — veCZM reference

---

## 9. License

본 contract는 **MIT License**로 배포되며, 누구나 자유롭게 사용·복제·수정할 수 있다.
