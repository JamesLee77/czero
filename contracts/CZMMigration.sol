// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBurnable {
    function burnFrom(address account, uint256 amount) external;
}

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/**
 * @title CZM Migration (v1 → v2)
 * @notice v1 토큰을 burn하고 v2 토큰을 mint하는 1:1 (또는 인센티브) swap.
 *         소수 사전판매 holder + 향후 v2 컨트랙트 출시 시 사용.
 *
 * Architecture:
 *   - v1: 사전판매에 사용된 CZMToken (ERC20Burnable, MINTER_ROLE 보유 admin)
 *   - v2: 새 CZMTokenV2 (이 컨트랙트에 MINTER_ROLE을 grant해야 함)
 *   - bonusBps: 0=1:1, 500=1.05x (5% 인센티브)
 *
 * Flow:
 *   1) Admin이 v2의 MINTER_ROLE을 본 컨트랙트에 grant
 *   2) Holder가 v1.approve(migration, amount) 또는 permit + migrateWithPermit
 *   3) migrate(amount) 호출 → v1 burnFrom + v2 mint to msg.sender
 *   4) 만료 시 admin이 close()로 영구 종료
 *
 * Safety:
 *   - Pausable (긴급 정지)
 *   - Deadline (만료 후 자동 차단)
 *   - bonusBps cap (50% 이상 못 설정)
 *   - non-reentrant
 */
contract CZMMigration is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public immutable v1Token;
    IMintable public immutable v2Token;

    uint256 public constant MAX_BONUS_BPS = 5_000; // 50% cap
    uint256 public constant BPS = 10_000;

    uint256 public bonusBps;          // 0 = 1:1
    uint256 public deadline;          // unix seconds, after which migration disabled
    bool    public paused;
    bool    public closed;            // permanently disabled

    uint256 public totalMigrated;     // 누적 v1 burn된 양
    mapping(address => uint256) public migratedBy;

    event Migrated(address indexed user, uint256 v1Burned, uint256 v2Minted);
    event Paused(bool paused);
    event Closed();
    event BonusUpdated(uint256 oldBps, uint256 newBps);
    event DeadlineUpdated(uint256 oldDeadline, uint256 newDeadline);

    constructor(
        address v1_,
        address v2_,
        uint256 bonusBps_,
        uint256 deadline_,
        address admin
    ) {
        require(v1_ != address(0) && v2_ != address(0) && admin != address(0), "Migration: zero");
        require(bonusBps_ <= MAX_BONUS_BPS, "Migration: bonus too high");
        require(deadline_ > block.timestamp, "Migration: deadline past");
        v1Token = IERC20(v1_);
        v2Token = IMintable(v2_);
        bonusBps = bonusBps_;
        deadline = deadline_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ============================================================
    //  Migration
    // ============================================================

    function _doMigrate(address user, uint256 amount) internal {
        require(!paused && !closed, "Migration: not active");
        require(block.timestamp <= deadline, "Migration: expired");
        require(amount > 0, "Migration: zero amount");

        // CEI: compute, update state, emit BEFORE external calls.
        uint256 v2Amount = amount + (amount * bonusBps) / BPS;
        totalMigrated += amount;
        migratedBy[user] += v2Amount;
        emit Migrated(user, amount, v2Amount);

        // External: burn v1 (requires prior approve), mint v2 to user.
        IBurnable(address(v1Token)).burnFrom(user, amount);
        v2Token.mint(user, v2Amount);
    }

    /// @notice Migrate v1 → v2. User must approve(migration, amount) first.
    function migrate(uint256 amount) external nonReentrant {
        _doMigrate(msg.sender, amount);
    }

    /**
     * @notice Migrate via EIP-2612 permit (gasless approve).
     * @dev v1 token must support ERC20Permit.
     */
    function migrateWithPermit(
        uint256 amount,
        uint256 permitValue,
        uint256 permitDeadline,
        uint8 v, bytes32 r, bytes32 s
    ) external nonReentrant {
        IERC20Permit(address(v1Token)).permit(
            msg.sender, address(this), permitValue, permitDeadline, v, r, s
        );
        _doMigrate(msg.sender, amount);
    }

    // ============================================================
    //  Admin
    // ============================================================

    function setPaused(bool p) external onlyRole(ADMIN_ROLE) {
        paused = p;
        emit Paused(p);
    }

    /// @notice Permanently close. Cannot be undone.
    function close() external onlyRole(ADMIN_ROLE) {
        closed = true;
        emit Closed();
    }

    function setBonus(uint256 newBonusBps) external onlyRole(ADMIN_ROLE) {
        require(newBonusBps <= MAX_BONUS_BPS, "Migration: bonus too high");
        emit BonusUpdated(bonusBps, newBonusBps);
        bonusBps = newBonusBps;
    }

    function setDeadline(uint256 newDeadline) external onlyRole(ADMIN_ROLE) {
        require(newDeadline > block.timestamp, "Migration: deadline past");
        emit DeadlineUpdated(deadline, newDeadline);
        deadline = newDeadline;
    }

    /// @notice Recover any ERC20 mistakenly sent to this contract.
    function recoverERC20(address token, address to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(to != address(0), "Migration: to zero");
        IERC20(token).safeTransfer(to, amount);
    }
}
