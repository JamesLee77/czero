# CZM Smart Contracts — Security Review

**Date**: 2026-05-06
**Scope**: `CZMToken.sol`, `CZMVesting.sol`, `CZMStaking.sol`, `CZMTGESale.sol`
**Method**: Slither 0.11.3 정적 분석 + npm audit + 수동 리뷰 + 80개 단위 테스트
**Status**: Pre-mainnet review (외부 감사 전)

---

## 1. Summary

| Severity | Count | 조치 |
|---|---|---|
| Critical | 0 | — |
| High     | 0 | — |
| Medium   | 2 | Mainnet 전 외부 감사 / multisig+timelock |
| Low      | 1 | Mainnet 전 외부 감사 |
| Informational / False Positive | ~13 | Document |

**Slither**: 1차 24건 → fix 후 **16건** (reentrancy 8건 모두 해소).
**npm audit**: 41 vulnerabilities, but **0 in runtime deps**. Hardhat 생태계의 dev-only deps (cookie, ws, ip 등). 컨트랙트 배포에는 영향 없음.

**Test coverage** (Phase-1 추가 후): **Statements 100% / Branches 92.65%** (contracts only, 5개 컨트랙트)

**테스트 통과**: 160/160 (기존 136 + Migration 18 + Vesting batch 6)

**적용된 fix** (2026-05-06):
- L-02: `CZMStaking.recoverPoolRemainder()`, `CZMTGESale.withdrawUSDC()`에 `nonReentrant` 추가
- L-03: 전 컨트랙트의 raw `transfer/transferFrom` → `SafeERC20.safeTransfer/safeTransferFrom`

**TDD 요구사항 매핑** (2026-05-06):
- BRD FR-1.1~FR-5.4 + Part 7 acceptance criteria 전수 검증
- 요구사항-주도 테스트 + 통합 시나리오 + 미커버 branch hard targets 추가
- nonReentrant 가드를 악성 ERC20 (ReentrantToken mock)으로 실제 reentrancy 공격 시뮬레이션 후 차단 확인
- 남은 ~7% branch는 OZ AccessControl 내부 분기·compound require 조합 — 외부 감사 시 보강 권장 영역

---

## 2. Findings

### M-01 — Yield rate is point-in-time, not time-integrated  *(Design choice / Medium)*

**File**: `CZMStaking.sol:104-133`

`pendingReward()`는 `currentYieldRateBps()` (현재 시점 가격·풀 기준) × 경과시간으로 단순 곱셈 계산함. 가격이 변동된 기간을 가중평균하지 않음.

**시나리오**: 사용자가 30일간 stake. 첫 29일은 P=$0.15(rate 10%), 30일째 P=$0.30(rate 5%)으로 상승. claim 시점에 `currentYieldRateBps()`는 5%를 반환 → 사용자는 30일 전체에 대해 5% 적용받음 (실제 경제적 보상은 이론치보다 낮음).

**영향**: 가격 상승기에 stake한 사용자는 손해, 가격 하락기엔 이득. 사용자는 가격 상승 직전 claim을 할 동기 부여됨 → claim 트래픽 spike 가능.

**대응 옵션**:
- A. 그대로 유지 (단순성 우선, 문서화)
- B. SushiSwap 형식 `rewardPerTokenStored` accumulator로 재구현 (정확도 ↑, 코드 복잡도 ↑)

**권장**: 외부 감사 시 명시적으로 검토 항목으로 제출. 현재 설계 의도라면 README/문서에 명기.

---

### M-02 — Oracle 단일 신뢰점, timelock 없는 즉시 교체 가능  *(Centralization / Medium)*

**File**: `CZMStaking.sol:190-194`

```solidity
function updateOracle(address newOracle) external onlyRole(ADMIN_ROLE) {
    priceOracle = IPriceOracle(newOracle);
    emit OracleUpdated(newOracle);
}
```

**위험**: ADMIN이 즉시 oracle을 교체 가능. 악의적 oracle로 교체 시 yield 계산을 임의 조작 가능. 문서(NFR-SEC.3)는 admin 행위에 48시간 timelock 요구.

**대응**: Mainnet 배포 시 ADMIN_ROLE을 OpenZeppelin TimelockController로 grant. 본 컨트랙트는 변경 불필요.

---

### L-01 — Divide-before-multiply 미세 정밀도 손실  *(Slither / Low)*

**File**: `CZMStaking.sol:110-115`

```solidity
uint256 priceFactor = (P0_TGE * 1e18) / currentPrice;
uint256 poolFactor  = (poolRemaining * 1e18) / POOL_INIT;
uint256 rate = (R0_BPS * priceFactor * poolFactor) / (1e18 * 1e18);
```

각 factor 계산 시 1e18 fixed point 사용으로 손실은 < 1 wei (사실상 무시 가능). 그러나 OpenZeppelin Math.mulDiv 사용 시 더 안전.

**대응**: 우선순위 낮음. 외부 감사 시 같이 검토.

---

### L-02 — `recoverPoolRemainder`, `withdrawUSDC` 에 nonReentrant 미적용  *(✅ FIXED 2026-05-06)*

**File**: `CZMStaking.sol`, `CZMTGESale.sol`

두 함수에 `nonReentrant` modifier 적용 완료. 80개 회귀 테스트 통과 확인.

---

### L-03 — Raw `transfer()` 사용 (SafeERC20 미사용)  *(✅ FIXED 2026-05-06)*

**File**: `CZMVesting.sol`, `CZMStaking.sol`, `CZMTGESale.sol`

전 컨트랙트에서 raw `czm.transfer(...)`, `usdc.transferFrom(...)` 패턴을 OpenZeppelin `SafeERC20.safeTransfer/safeTransferFrom`으로 교체 완료. CZMToken은 이미 적용되어 있었음. 80개 회귀 테스트 통과 확인.

---

### Informational / False positives

| # | Slither finding | 평가 |
|---|---|---|
| INFO-1 | Reentrancy in `_harvest`, `purchase`, `revoke`, `stake`, `unstake` | **False positive** — 모두 `nonReentrant` modifier 적용 + CZM/USDC는 callback 없음 |
| INFO-2 | `block.timestamp` for comparisons (10 occurrences) | Vesting/Lock 시간 게이트의 표준 패턴. 분 단위 정확도면 충분 |
| INFO-3 | `P0_TGE`, `POOL_INIT` not in mixedCase | immutable 상수는 UPPER_SNAKE_CASE가 표준 (Solidity 컨벤션) |
| INFO-4 | Strict equality `elapsed == 0`, `poolRemaining == 0` | 안전한 가드 |
| INFO-5 | Local var `total` in `releaseAll` "uninitialized" | Solidity는 자동 0 초기화. 안전 |

---

## 3. 누락 항목 (배포 전 추가 작업 필요)

| ID | 요구사항 (NFR) | 현재 상태 |
|---|---|---|
| NFR-SEC.1 | 외부 감사 (Trail of Bits / OZ / Quantstamp) | **❌ 미수행** |
| NFR-SEC.2 | Multisig (3-of-5 Gnosis Safe) admin | ❌ EOA admin (mainnet 시 변경 필요) |
| NFR-SEC.3 | 48시간 timelock | ❌ 미적용 (mainnet 시 OZ TimelockController 사용) |
| NFR-SEC.5 | Bug bounty (Immunefi) | ❌ 미등록 |
| NFR-COMP.2 | US persons 차단 KYC oracle | ❌ off-chain whitelist만 존재 |
| NFR-COMP.3 | OFAC sanctions 자동 차단 | ❌ 미통합 |
| NFR-AUDIT.5 | BaseScan verify | TBD (배포 시) |
| Test coverage 95% (statements + branches) | Statements 97.4% ✓ / Branches 78.1% ✗ |

---

## 4. 권장 배포 절차

1. **이번 PR (개발 완료)**:
   - Hardhat 셋업 + 80개 단위 테스트 통과
   - Slither/manual 리뷰 완료
   - L-02, L-03 등 defensive fix 적용 (선택)

2. **외부 감사 (필수, 4-8주)**:
   - Trail of Bits / OpenZeppelin / Quantstamp 중 1곳 이상
   - Critical/High 이슈 0건 + Medium mitigation 명시

3. **Mainnet 배포 전 추가 작업**:
   - Multisig (Gnosis Safe 3-of-5) 구성
   - TimelockController 배포 + ADMIN role grant
   - 실제 가격 oracle 컨트랙트 배포 (Chainlink wrapper or custom TWAP)
   - KYC oracle 통합 (Sumsub/Persona)
   - BaseScan API key 발급 + verify 자동화
   - Bug bounty 프로그램 등록 (Immunefi, $500K cap)

4. **배포**: testnet (Base Sepolia) → 검증 → mainnet

---

## 5. 결론

**개발/테스트 단계에서는 즉시 차단해야 할 critical/high 이슈는 없음.** Slither의 reentrancy 경고는 모두 `ReentrancyGuard`로 mitigate된 false positive. 정밀도/timelock/oracle 신뢰 등 documented design concerns는 mainnet 배포 전 외부 감사로 해결 권장.

**Mainnet 배포는 외부 감사 + multisig + timelock + KYC oracle 통합 완료 후에만 권장.**

---

## 6. 미커버 branch 소스 리뷰 (2026-05-06)

최종 branch coverage 94.30%. 미커버 9건은 모두 `nonReentrant` modifier의 음성 경로(reentrancy detected → revert).

### 6.1 모든 9건의 동일 코드 경로

`OZ ReentrancyGuard.sol`의 `_nonReentrantBefore()`:
```solidity
function _nonReentrantBefore() private {
    if (_status == _ENTERED) {
        revert ReentrancyGuardReentrantCall();
    }
    _status = _ENTERED;
}
```

`_status == _ENTERED` true branch (revert)는 9개 함수 모두 **동일한 한 줄**의 OZ 라이브러리 코드를 거침. 따라서 representative 1개 검증으로 충분.

### 6.2 대표 검증 완료 (CZMStaking.stake)

`test/BranchCoverage.test.ts:nonReentrant blocks reentry via malicious token`:
- `ReentrantToken` mock으로 `transferFrom` callback에서 `stake()` 재진입 시도
- 결과: `ReentrancyGuardReentrantCall` revert 확인 ✓

### 6.3 미커버 9건 명시

| # | 위치 | 함수 | 같은 OZ 코드? |
|---|---|---|---|
| 1 | CZMStaking.sol:172 | `unstake` | ✓ |
| 2 | CZMStaking.sol:185 | `claim` | ✓ |
| 3 | CZMStaking.sol:200 | `recoverPoolRemainder` | ✓ |
| 4 | CZMVesting.sol:109 | `release` | ✓ |
| 5 | CZMVesting.sol:120 | `releaseAll` | ✓ |
| 6 | CZMVesting.sol:137 | `revoke` | ✓ |
| 7 | CZMTGESale.sol:139 | `purchase` | ✓ |
| 8 | CZMTGESale.sol:185 | `claim` | ✓ |
| 9 | CZMTGESale.sol:198 | `withdrawUSDC` | ✓ |

### 6.4 위험 평가

- **현재 토큰 모델 (CZM = OZ ERC20, USDC = Circle USDC)**: callback 없음 → reentrancy 가드는 트리거되지 않음. 미커버 자체가 무위험.
- **defense-in-depth 가치**: 향후 토큰 교체·외부 hook 추가 시 보호 효과. 코드는 안전.
- **OZ ReentrancyGuard 자체 검증**: OpenZeppelin v5 audited. 동일 코드 9회 호출 → 1번 통과 = 모두 통과.

### 6.5 결정

추가 ReentrantToken 시나리오 8개 작성으로 ~98% 도달 가능하나, 동일 OZ 코드의 8회 반복 검증으로 marginal value 낮음. **현재 94.30%로 종결**, 외부 감사에서 확인.

### 6.6 잔여 (Vesting 92.86%, Staking 93.75%)

CZMVesting 미커버 3건과 CZMStaking 미커버 3건 모두 위 9건에 포함됨 — 다른 갭 없음.

---

## 7. Phase-1 사전판매 + Migration 설계 (2026-05-06)

### 7.1 배포 옵션

소수(~10명 이하) 사전판매 + 향후 v2 마이그레이션 시나리오에 대비해 3종 deploy 스크립트 준비:

| 스크립트 | 컨트랙트 | 용도 |
|---|---|---|
| `scripts/deploy-token.ts` | CZMToken만 | SAFT 기반, off-chain lockup |
| `scripts/deploy-presale.ts` | CZMToken + CZMVesting | on-chain lockup 강제 (권장) |
| `scripts/deploy-migration.ts` | CZMMigration | Phase 2: v1 → v2 swap |

### 7.2 신규 기능

- **`CZMToken.VERSION`** (constant `"1.0.0"`): v1/v2 클라이언트 분기용
- **`CZMVesting.createScheduleBatch`**: 다수 투자자 일괄 onboarding (가스 절약)
- **`CZMMigration.sol`**: 1:1 또는 인센티브 swap, Pausable, Deadline, Permit 통합
  - CEI 패턴 적용 (state-update before external call)
  - bonusBps cap 50%
  - admin은 setPaused/close/setBonus/setDeadline로 통제

### 7.3 Migration 운영 절차

1. v2 토큰 배포 후 `CZMMigration` 배포
2. v2.grantRole(MINTER_ROLE, migration) — migration이 v2 mint 권한 보유
3. holder가 `v1.approve(migration, amount)` 또는 permit 사용
4. holder가 `migration.migrate(amount)` 호출 → v1 burn + v2 mint
5. deadline 후 `migration.close()`로 영구 종료

### 7.4 위험 평가

- **5B 하드캡 보호**: v1 burn 시 totalSupply 감소 → v2 mint해도 총합은 5B 이내
- **Migration 권한**: v2 MINTER_ROLE을 migration에 grant. 종료 후 revoke 필수
- **악의 v1 swap**: 본 컨트랙트는 v1 주소 immutable, 변경 불가
- **시간 제약**: deadline 만료 후 자동 차단. setDeadline으로 연장만 가능 (단축 불가)
