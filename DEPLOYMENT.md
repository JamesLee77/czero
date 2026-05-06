# CZM Smart Contract Deployment Record

> 본 문서는 배포된 컨트랙트의 주소·tx hash·검증 상태를 시간순으로 기록한다.
> 새 배포·마이그레이션 시 항상 이 문서를 갱신한다.

---

## Phase 1 — Pre-sale Infrastructure (Base Sepolia Testnet)

### Network

| 항목 | 값 |
|---|---|
| Chain | **Base Sepolia** |
| Chain ID | `84532` |
| RPC | `https://sepolia.base.org` |
| Explorer | https://sepolia.basescan.org |
| Deploy Date | **2026-05-06 (UTC)** |
| Solidity | `0.8.24` (Cancun EVM, optimizer 200 runs) |

### Deployer / Admin (Testnet Dev Key)

| 항목 | 값 |
|---|---|
| Address | `0xB722843587DA96bdFb5638Bb0AbC8FC56a9dfa1D` |
| Roles | `DEFAULT_ADMIN_ROLE` + `MINTER_ROLE` + `PAUSER_ROLE` (Token), `SCHEDULE_MANAGER_ROLE` (Vesting) |
| Type | Single EOA — **TESTNET ONLY** |

> ⚠️ 본 키는 testnet 단독 배포용. Mainnet 배포 시 multisig (Gnosis Safe 3-of-5)로 즉시 교체 필수.

### Deployed Contracts

| 컨트랙트 | 주소 | BaseScan | Verify |
|---|---|---|---|
| **CZMToken v1.0.0** | `0x5b4319dB4b2949E921400D850838508BB8a510CE` | [view](https://sepolia.basescan.org/address/0x5b4319dB4b2949E921400D850838508BB8a510CE) | ✅ [code](https://sepolia.basescan.org/address/0x5b4319dB4b2949E921400D850838508BB8a510CE#code) |
| **CZMVesting** | `0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79` | [view](https://sepolia.basescan.org/address/0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79) | ✅ [code](https://sepolia.basescan.org/address/0xa73d068Bf89F303C009E19d05Fbe40f47eeE1d79#code) |

### Initial State (post-deploy snapshot)

#### CZMToken
- `name`: "C-ZERO Mining Token"
- `symbol`: "CZM"
- `decimals`: 18
- `cap`: 5,000,000,000 CZM
- `totalSupply`: 0 CZM (mint 대기)
- `paused`: `false`

#### CZMVesting
- `czm`: `0x5b4319dB4b2949E921400D850838508BB8a510CE` (Token 연결 확인)
- `getScheduleCount`: 0

---

## 다음 단계 (Phase 1 운영)

### 사전판매 onboarding 절차

각 KYC 완료된 투자자 (소수)에 대해:

```ts
// 1. Admin이 vesting 컨트랙트로 투자자 할당분 mint
await token.mint("<vestingAddr>", amountInWei);

// 2. Admin이 schedule 생성 (개별 또는 batch)
await vesting.createSchedule(
  investorAddr,    // beneficiary
  amountInWei,     // 18 decimals
  startTime,       // 보통 sale 종료 시점
  cliffSeconds,    // 예: 12개월 = 31_536_000
  vestSeconds,     // 예: 36개월 = 94_608_000
  true             // revocable (Phase 2 migration 시 회수 가능하게)
);

// (or batch)
await vesting.createScheduleBatch(
  [a1, a2, a3], [amt1, amt2, amt3],
  startTime, cliffSeconds, vestSeconds, true
);
```

### Phase 2 마이그레이션 준비

소스 변경 (Node/Mining 등) 발생 시:
1. CZMTokenV2 배포
2. CZMMigration 배포 (`scripts/deploy-migration.ts`)
3. v2.grantRole(MINTER_ROLE, migrationAddr)
4. 사전판매 holders가 `migrate()` 호출 → v1 burn + v2 mint

---

## Mainnet 배포 전 체크리스트

| 항목 | 상태 |
|---|---|
| 외부 감사 (Trail of Bits / OZ / Quantstamp) | ❌ 미수행 |
| Admin → Multisig (Gnosis Safe 3-of-5) | ❌ 현재 EOA |
| Timelock (48h) | ❌ 미적용 |
| Bug bounty (Immunefi) | ❌ 미등록 |
| KYC oracle 통합 | ❌ off-chain only |
| 사전판매 SAFT 템플릿 + migration 조항 | ⚠️ 별도 법무 검토 필요 |
| Holder registry (off-chain DB) | ⚠️ 운영 시 갖출 것 |

상세는 [`SECURITY_REVIEW.md`](./SECURITY_REVIEW.md) 참조.

---

## Pre-sale 시뮬레이션 (Base Sepolia, 2026-05-06)

`scripts/simulate-presale.ts`로 전체 onboarding → claim → revoke 흐름을 testnet에서 검증.

### 시나리오
- **Alice**: `0x048f42B850cC126468EE112852b6aC67e08e5d24` (random EOA, testnet only)
- 할당: **1000 CZM**, cliff=0, duration=300s, revocable=true

### 흐름과 결과

| Step | Tx | 결과 |
|---|---|---|
| 1. Admin → alice ETH 0.00002 (gas) | [`0xf9de40...`](https://sepolia.basescan.org/tx/0xf9de40706a1c87c7676cf2ed1f4cb0de2ba2351cd8c3d41d2fae1c80a767b379) | ✅ |
| 2. Admin mint 1000 CZM → vesting | [`0x6dd160...`](https://sepolia.basescan.org/tx/0x6dd1600dfbaadec851a98ebb6acf6f33384f5c0ca185515d35df55d182b76c33) | totalSupply 0 → 1000 |
| 3. Admin createSchedule(alice, 1000, ...) | [`0xd489ec...`](https://sepolia.basescan.org/tx/0xd489ec067d67f42b331ada4ffb3ff1ddb21a89c320a25a62d986c4f98985e647) | schedule id 0 |
| 4. Alice release() | [`0xeb7c80...`](https://sepolia.basescan.org/tx/0xeb7c80df2195dbb7b6923a531673924143bd40bf5f309ca113af6b050445a507) | alice +443.33 CZM |
| 5. Admin revoke(0) | [`0xc05518...`](https://sepolia.basescan.org/tx/0xc05518736161ca3df4806e85b6132f77dc6a25c4a6387fdaff472897bcba58ad) | alice +246.67, admin +310 |

### 최종 상태
- **Alice**: 690 CZM (1차 release + revoke 시 추가 vested)
- **Admin**: 310 CZM (회수)
- **Vesting 잔액**: 0 (전부 분배 완료)
- **Total supply**: 1000 (변동 없음)
- **Admin ETH 사용**: ~0.000022 ETH (gas + alice 선지원)

### 검증된 동작
- ✅ Mint → Vesting 격리 (lockup 강제됨)
- ✅ Cliff 후 시간 비례 vest
- ✅ beneficiary가 직접 release 호출 가능
- ✅ revoke 시 vested portion은 beneficiary에 인도, 잔여는 admin 환원
- ✅ 회계 무결성: 690 + 310 = 1000 (입출 일치)

### 운영 참고 (testnet 발견 사항)
- **hardhat-ethers state caching**: testnet에서 `tx.wait()` 직후 `view` 호출이 stale state 반환 → script에 `POST_TX_DELAY_MS=4000` 추가
- **estimateGas 실패**: 같은 캐시 문제로 revoke 시 underflow 오인 → 모든 tx에 explicit `gasLimit` 지정 권장
- **Faucet drip 작음**: 0.0001 ETH로 5개 tx 가능 (Base Sepolia 가스 매우 저렴)

---

## Phase 2 Migration 시연 (Base Sepolia, 2026-05-06)

`scripts/simulate-migration.ts`로 v1 → v2 swap을 testnet에서 검증.

### 추가 배포

| Contract | Address | Verify |
|---|---|---|
| **CZMToken v1.0.0 (v2 instance)** | [`0xC51AC33D23f7cCff7ddF83b751C52AF8ff50057c`](https://sepolia.basescan.org/address/0xC51AC33D23f7cCff7ddF83b751C52AF8ff50057c#code) | ✅ |
| **CZMMigration** (1:1, 30일 deadline) | [`0x1a3Fb22873fF0778069c7708A40E1CEA48Bb660c`](https://sepolia.basescan.org/address/0x1a3Fb22873fF0778069c7708A40E1CEA48Bb660c#code) | ✅ |

> 시연용으로 v2도 같은 CZMToken bytecode 사용 (실제 운영에서는 Node/Mining hook 등 신규 기능 포함된 다른 컨트랙트가 됨).

### 사전 셋업

| Step | Tx | 결과 |
|---|---|---|
| v2 토큰 배포 | (deploy) | totalSupply 0 |
| Migration 배포 (v1, v2, bonus=0, deadline=30d) | (deploy) | initialized |
| `v2.grantRole(MINTER_ROLE, migration)` | [`0xde0b58...`](https://sepolia.basescan.org/tx/0xde0b58b20fd40ce6774e18d5ad1d840b2896f75f9bc4a96c21453b87acd964c6) | migration이 v2 mint 가능 |

### Swap 흐름

| Step | Holder | Tx | 결과 |
|---|---|---|---|
| 1. alice.approve(migration, 690) | alice | [`0x41cd5a...`](https://sepolia.basescan.org/tx/0x41cd5a76e6d97a92943d93f4a203f44328d93be2c5af62136ec1046cc008ea58) | allowance 690 |
| 2. alice.migrate(690) | alice | [`0xbef484...`](https://sepolia.basescan.org/tx/0xbef484f12acd5d5b0ddacb4b51ab3b9adffe873fe3ab8c96071c8b9f45c273b1) | v1 burn 690, v2 mint 690 |
| 3. admin.approve(migration, 310) | admin | [`0x74c403...`](https://sepolia.basescan.org/tx/0x74c403652cdf24bac82590db8878204b3a903fc0186203829f45ef2a4b717fa3) | allowance 310 |
| 4. admin.migrate(310) | admin | [`0xf66c8d...`](https://sepolia.basescan.org/tx/0xf66c8ddf92c33c72e843cb9fbfb4b519d35d23b93b81bb88b650154a2dbc8d06) | v1 burn 310, v2 mint 310 |

### 최종 상태

| 자산 | 사전 | 사후 |
|---|---|---|
| Alice v1 | 690 | **0** |
| Alice v2 | 0 | **690** |
| Admin v1 | 310 | **0** |
| Admin v2 | 0 | **310** |
| v1 totalSupply | 1000 | **0** (전부 burn) |
| v2 totalSupply | 0 | **1000** (전부 mint) |
| migration.totalMigrated | 0 | **1000** |

### 검증된 동작
- ✅ v1 burn (`burnFrom` via 사용자 approve)
- ✅ v2 mint (migration이 MINTER_ROLE로 mint)
- ✅ 1:1 ratio (bonusBps=0)
- ✅ totalSupply 무결성 (v1 burned == v2 minted == 1000)
- ✅ Alice (random EOA) + Admin (deployer) 모두 swap 성공
- ✅ CEI 패턴 (state update before external call) — slither warning 0

### 운영 참고
- **MINTER_ROLE 회수**: 마이그레이션 종료 후 `v2.revokeRole(MINTER_ROLE, migration)`으로 권한 회수 권장
- **Permit 버전**: gasless approve가 필요한 holder는 `migrateWithPermit()` 사용 (테스트 통과 확인됨)
- **deadline 만료**: `migration.close()`로 영구 종료 가능

---

## Frontend Portal — Cloudflare Pages 배포

### 배포 정보

| 항목 | 값 |
|---|---|
| Hosting | **Cloudflare Pages** (Wrangler CLI) |
| Project | `czero-portal` |
| Account | `misterylee@gmail.com's Account` (id `e82458744ebc655e58fe5194e6fb93fd`) |
| Production URL | **https://czero-portal.pages.dev** |
| First deploy | 2026-05-06 |
| Stack | Vite 8 + React 18 + wagmi v2 + RainbowKit + Tailwind v4 |

### 배포 절차 (재실행 가능)

```bash
cd frontend
npm install
npm run build
CLOUDFLARE_ACCOUNT_ID=e82458744ebc655e58fe5194e6fb93fd \
  npx wrangler pages deploy dist --project-name=czero-portal --branch=main
```

또는 한 줄:
```bash
cd frontend && npm run deploy   # CLOUDFLARE_ACCOUNT_ID env 사전 설정 필요
```

### 첫 배포 시 1회만 (이미 완료)

```bash
CLOUDFLARE_ACCOUNT_ID=... npx wrangler pages project create czero-portal --production-branch=main
```

### 환경변수 (Cloudflare Dashboard에서 설정)

Dashboard → Pages → czero-portal → Settings → Environment variables:
- `VITE_WALLETCONNECT_PROJECT_ID` (production용 — https://cloud.walletconnect.com 발급)
- `NODE_VERSION = 20`

> 주의: 환경변수 변경 후 **재배포** 필요 (Vite는 빌드 타임에 `import.meta.env`를 inline)

### SPA Routing

`frontend/public/_redirects` 파일이 모든 경로를 `index.html`로 fallback → React Router가 client-side에서 처리.

---

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-06 | Phase 1 testnet 배포 완료 (CZMToken + CZMVesting), BaseScan verify 완료 |
| 2026-05-06 | Pre-sale 시뮬레이션 완료 (mint/createSchedule/release/revoke 전 흐름 검증) |
| 2026-05-06 | Phase 2 Migration 시연 완료 (v1 1000 burn → v2 1000 mint, 회계 무결성 확인) |
| 2026-05-06 | Frontend Portal Cloudflare Pages 배포 완료 (https://czero-portal.pages.dev) |
