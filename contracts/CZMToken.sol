// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title C-ZERO Mining Token (CZM)
 * @notice C-ZERO 생태계의 utility token.
 *         탄소 마이닝 보상, DeFi 가스, 거버넌스 등의 용도로 사용됨.
 *
 * Properties:
 *   - 표준: ERC-20 + Burnable + Capped + Pausable + Permit
 *   - 총 발행량: 5,000,000,000 (5B) — 하드캡
 *   - 18 decimals
 *
 * Roles:
 *   - DEFAULT_ADMIN_ROLE  : 다른 role 부여/회수 (multisig)
 *   - MINTER_ROLE         : mint 권한 (TGESale, Vesting, Staking에 부여)
 *   - PAUSER_ROLE         : 비상 정지 (multisig only)
 *
 * @dev VARA 라이선스 기반 utility token. US persons 매수는 별도 KYC layer에서 차단.
 */
contract CZMToken is ERC20, ERC20Burnable, ERC20Capped, ERC20Pausable, ERC20Permit, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant MAX_SUPPLY = 5_000_000_000 * 10**18; // 5B with 18 decimals

    event TokensRecovered(address indexed token, address indexed to, uint256 amount);

    constructor(address admin)
        ERC20("C-ZERO Mining Token", "CZM")
        ERC20Capped(MAX_SUPPLY)
        ERC20Permit("C-ZERO Mining Token")
    {
        require(admin != address(0), "CZM: admin zero");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /// @notice 토큰 발행. MINTER_ROLE 보유자만 호출 가능. 하드캡 초과 시 revert.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /// @notice 비상 시 모든 transfer 일시 중단. governance(multisig) 통제 권장.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice 컨트랙트로 잘못 전송된 다른 ERC-20 토큰 회수 (자기 자신은 회수 불가).
    function recoverERC20(address tokenAddr, address to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(tokenAddr != address(this), "CZM: cannot recover self");
        require(to != address(0), "CZM: to zero");
        IERC20(tokenAddr).safeTransfer(to, amount);
        emit TokensRecovered(tokenAddr, to, amount);
    }

    // -------- Required overrides (multiple inheritance) --------

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Capped, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
