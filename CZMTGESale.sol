// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CZM TGE Sale
 * @notice Multi-tier TGE 판매. Seed @ $0.15 / Series A @ $0.20.
 *         KYC whitelist, USDC 결제, 자동 vesting/lock 처리.
 *
 * Flow:
 *   1) admin이 round 정의 (price, hardCap, lock duration 등)
 *   2) admin이 KYC 통과자 whitelist 등록
 *   3) 투자자가 USDC로 매수 → CZM 즉시 본 contract에 lock
 *   4) lock 기간 종료 후 vest schedule에 따라 claim
 *
 * Lock-up + Vesting:
 *   - Seed:     12개월 cliff + 24개월 linear vest
 *   - Series A:  6개월 cliff + 12개월 linear vest
 *
 * @dev US persons는 별도 KYC oracle layer에서 차단 (OFAC + nationality).
 */
contract CZMTGESale is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public immutable czm;
    IERC20 public immutable usdc;

    struct Round {
        string  name;
        uint256 priceUsdc;        // CZM unit price (USDC, 6 decimals)
        uint256 hardCapTokens;    // round의 최대 판매 CZM 수량 (18 decimals)
        uint256 soldTokens;       // 누적 판매량
        uint256 cliffSeconds;     // lock cliff
        uint256 vestSeconds;      // 전체 vesting 기간 (cliff 포함)
        uint256 startTime;        // 판매 개시 시점
        uint256 endTime;          // 판매 종료 시점
        bool    active;
    }

    Round[] public rounds;

    struct Allocation {
        uint256 totalAllocated;
        uint256 claimed;
        uint256 startTime;        // = round.startTime
        uint256 cliffSeconds;
        uint256 vestSeconds;
    }

    mapping(uint256 => mapping(address => Allocation)) public allocations;
    mapping(uint256 => mapping(address => bool)) public whitelist;

    // ----- Events -----
    event RoundCreated(uint256 indexed id, string name, uint256 priceUsdc, uint256 hardCap);
    event WhitelistSet(uint256 indexed roundId, address indexed user, bool ok);
    event Purchased(uint256 indexed roundId, address indexed buyer, uint256 czmAmt, uint256 usdcPaid);
    event Claimed(uint256 indexed roundId, address indexed user, uint256 amount);
    event RoundClosed(uint256 indexed roundId);

    constructor(address czm_, address usdc_, address admin) {
        require(czm_ != address(0) && usdc_ != address(0) && admin != address(0), "TGE: zero");
        czm = IERC20(czm_);
        usdc = IERC20(usdc_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ============================================================
    //  Round management (admin)
    // ============================================================

    /**
     * @notice 새 round 생성. hardCapTokens 만큼의 CZM이 미리 본 contract에 transfer되어 있어야 함.
     */
    function createRound(
        string calldata name,
        uint256 priceUsdc,        // 6 decimals (USDC)
        uint256 hardCapTokens,    // 18 decimals (CZM)
        uint256 cliffSeconds,
        uint256 vestSeconds,
        uint256 startTime,
        uint256 endTime
    ) external onlyRole(ADMIN_ROLE) returns (uint256 id) {
        require(priceUsdc > 0, "TGE: price zero");
        require(hardCapTokens > 0, "TGE: hardcap zero");
        require(vestSeconds >= cliffSeconds, "TGE: vest < cliff");
        require(endTime > startTime, "TGE: end < start");

        id = rounds.length;
        rounds.push(Round({
            name: name,
            priceUsdc: priceUsdc,
            hardCapTokens: hardCapTokens,
            soldTokens: 0,
            cliffSeconds: cliffSeconds,
            vestSeconds: vestSeconds,
            startTime: startTime,
            endTime: endTime,
            active: true
        }));
        emit RoundCreated(id, name, priceUsdc, hardCapTokens);
    }

    function closeRound(uint256 roundId) external onlyRole(ADMIN_ROLE) {
        require(rounds[roundId].active, "TGE: already closed");
        rounds[roundId].active = false;
        emit RoundClosed(roundId);
    }

    function setWhitelist(uint256 roundId, address user, bool ok) external onlyRole(ADMIN_ROLE) {
        whitelist[roundId][user] = ok;
        emit WhitelistSet(roundId, user, ok);
    }

    function setWhitelistBatch(uint256 roundId, address[] calldata usersList, bool ok)
        external onlyRole(ADMIN_ROLE)
    {
        for (uint i = 0; i < usersList.length; i++) {
            whitelist[roundId][usersList[i]] = ok;
            emit WhitelistSet(roundId, usersList[i], ok);
        }
    }

    // ============================================================
    //  Purchase
    // ============================================================

    /**
     * @notice CZM 매수. USDC 결제. CZM은 본 contract에 lock되며 cliff 후 linear vest.
     * @param roundId   매수할 round
     * @param czmAmount 매수할 CZM 수량 (18 decimals)
     */
    function purchase(uint256 roundId, uint256 czmAmount) external nonReentrant {
        Round storage r = rounds[roundId];
        require(r.active, "TGE: round closed");
        require(block.timestamp >= r.startTime, "TGE: not started");
        require(block.timestamp <= r.endTime, "TGE: ended");
        require(whitelist[roundId][msg.sender], "TGE: not whitelisted");
        require(czmAmount > 0, "TGE: zero amount");
        require(r.soldTokens + czmAmount <= r.hardCapTokens, "TGE: hardcap exceeded");

        // USDC payment = czmAmount(18d) × price(6d) / 1e18
        uint256 usdcAmount = (czmAmount * r.priceUsdc) / 1e18;
        require(usdcAmount > 0, "TGE: usdc zero");

        require(usdc.transferFrom(msg.sender, address(this), usdcAmount), "TGE: usdc pay failed");
        r.soldTokens += czmAmount;

        Allocation storage a = allocations[roundId][msg.sender];
        if (a.totalAllocated == 0) {
            // first purchase
            a.startTime = r.startTime;
            a.cliffSeconds = r.cliffSeconds;
            a.vestSeconds = r.vestSeconds;
        }
        a.totalAllocated += czmAmount;

        emit Purchased(roundId, msg.sender, czmAmount, usdcAmount);
    }

    // ============================================================
    //  Claim (vested CZM)
    // ============================================================

    function claimable(uint256 roundId, address user) public view returns (uint256) {
        Allocation storage a = allocations[roundId][user];
        if (a.totalAllocated == 0) return 0;
        if (block.timestamp < a.startTime + a.cliffSeconds) return 0;
        uint256 elapsed = block.timestamp - a.startTime;
        uint256 vested;
        if (elapsed >= a.vestSeconds) {
            vested = a.totalAllocated;
        } else {
            vested = (a.totalAllocated * elapsed) / a.vestSeconds;
        }
        return vested - a.claimed;
    }

    function claim(uint256 roundId) external nonReentrant {
        uint256 amt = claimable(roundId, msg.sender);
        require(amt > 0, "TGE: nothing claimable");
        Allocation storage a = allocations[roundId][msg.sender];
        a.claimed += amt;
        require(czm.transfer(msg.sender, amt), "TGE: claim transfer failed");
        emit Claimed(roundId, msg.sender, amt);
    }

    // ============================================================
    //  Withdraw raised funds (admin)
    // ============================================================

    function withdrawUSDC(address to, uint256 amount) external onlyRole(ADMIN_ROLE) {
        require(to != address(0), "TGE: to zero");
        require(usdc.transfer(to, amount), "TGE: withdraw failed");
    }

    // ============================================================
    //  View helpers
    // ============================================================

    function getRound(uint256 id) external view returns (Round memory) {
        return rounds[id];
    }

    function getRoundCount() external view returns (uint256) {
        return rounds.length;
    }
}
