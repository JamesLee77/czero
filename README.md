# C-ZERO Smart Contracts

C-ZERO Mining Token ($CZM) 시스템의 Solidity smart contract 모음.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `CZM_Token_Design.md` | 전체 토큰 설계 문서 (배경·메커니즘·아키텍처) |
| `CZMToken.sol` | ERC-20 메인 토큰 (5B 하드캡, Burnable/Pausable/Permit) |
| `CZMVesting.sol` | Linear vesting with cliff (Foundation/Partners/Strategic 등) |
| `CZMStaking.sol` | 가격 탄력적 yield staking pool (200M cap, 자동 sunset) |
| `CZMTGESale.sol` | Multi-tier TGE 판매 (Seed $0.15 + Series A $0.20) |
| `deploy.ts` | Hardhat 배포 스크립트 |

## 의존성

```bash
npm install --save-dev hardhat @openzeppelin/contracts ethers
```

OpenZeppelin v5.0+ 필요 (`ERC20Capped`, `ERC20Pausable`, `ERC20Permit`, `AccessControl`).

## 컴파일

```bash
npx hardhat compile
```

Solidity `^0.8.20` 사용 (Cancun EVM 호환).

## 테스트 권장 항목

| 항목 | Contract | 설명 |
|---|---|---|
| Hard cap | CZMToken | mint 시 5B 초과 revert 확인 |
| Pause/Unpause | CZMToken | 비상 정지 시 transfer 차단 |
| Vesting cliff | CZMVesting | cliff 전 release = 0 확인 |
| Vesting linear | CZMVesting | cliff 후 시간에 비례 release 확인 |
| Vesting revoke | CZMVesting | 회수 시 vested portion 인도 + 잔여 환원 |
| Yield rate cap | CZMStaking | 가격 < TGE 시 yield = 10% (cap) |
| Yield rate decay | CZMStaking | 가격 2× → yield 50%로 감속 확인 |
| Pool exhaustion | CZMStaking | pool=0 시 yield=0 확인 |
| Eligibility check | CZMStaking | non-whitelisted stake() revert |
| TGE round | CZMTGESale | Seed/Series A 동시 운영, hardcap 준수 |
| TGE claim | CZMTGESale | cliff 후 vest 비율대로 claim |

## 배포 순서

```bash
# 1. 환경변수 설정
export ADMIN_ADDRESS=0x...                # multisig address
export USDC_ADDRESS=0x833589fCD6...        # Base USDC
export PRICE_ORACLE_ADDRESS=0x...          # 가격 oracle

# 2. testnet 먼저 배포
npx hardhat run scripts/deploy.ts --network base-sepolia

# 3. 검증 후 mainnet
npx hardhat run scripts/deploy.ts --network base-mainnet

# 4. BaseScan verify
npx hardhat verify --network base-mainnet <ADDRESS> <CONSTRUCTOR_ARGS>
```

## 보안 권고

1. **외부 감사 필수**: TGE 전 Trail of Bits / OpenZeppelin / Quantstamp 등 1개 이상의 감사
2. **Multisig admin**: 모든 admin role은 3-of-5 Gnosis Safe에 부여
3. **Timelock**: Admin 행위는 48시간 timelock을 거치도록 권장
4. **Bug bounty**: TGE 후 Immunefi 등록 (최대 보상 $500K)
5. **Upgrade 정책**: 모든 contract `non-upgradeable` (사용자 신뢰 우선)

## License

MIT License — 누구나 사용·복제·수정·재배포 가능.
