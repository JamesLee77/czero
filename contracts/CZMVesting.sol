// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CZM Vesting
 * @notice Linear vesting with cliff. 각 카테고리(Foundation/Partners/Strategic/Public 등)별로
 *         별도 schedule 생성 가능. cliff 기간 동안에는 0 release, 이후 선형 unlock.
 *
 * Schedule 구조:
 *   - beneficiary       : 수령자 주소
 *   - totalAmount       : 총 할당량
 *   - startTime         : vesting 시작 시각
 *   - cliffDuration     : cliff 기간 (초)
 *   - vestingDuration   : 전체 vesting 기간 (cliff 포함, 초)
 *   - released          : 이미 인출된 수량
 *   - revocable         : 관리자가 회수할 수 있는지 (true: Foundation/Partners 등)
 *   - revoked           : 회수 여부
 */
contract CZMVesting is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SCHEDULE_MANAGER_ROLE = keccak256("SCHEDULE_MANAGER_ROLE");

    IERC20 public immutable czm;

    struct Schedule {
        address beneficiary;
        uint256 totalAmount;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 vestingDuration;
        uint256 released;
        bool    revocable;
        bool    revoked;
    }

    Schedule[] public schedules;
    mapping(address => uint256[]) public scheduleIdsOf;

    event ScheduleCreated(uint256 indexed id, address indexed beneficiary, uint256 amount,
                          uint256 startTime, uint256 cliffDuration, uint256 vestingDuration);
    event Released(uint256 indexed id, address indexed beneficiary, uint256 amount);
    event ScheduleRevoked(uint256 indexed id, uint256 unreleased);

    constructor(address czm_, address admin) {
        require(czm_ != address(0) && admin != address(0), "Vesting: zero addr");
        czm = IERC20(czm_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SCHEDULE_MANAGER_ROLE, admin);
    }

    /**
     * @notice 새 vesting schedule 생성. 토큰은 먼저 본 컨트랙트로 transfer되어 있어야 함.
     * @param beneficiary    수령자
     * @param totalAmount    총 할당량 (wei)
     * @param startTime      시작 시각 (초)
     * @param cliffDuration  cliff 기간 (초). 예: 1년 = 365 days
     * @param vestingDuration 전체 vesting 기간 (cliff 포함, 초). cliffDuration ≤ vestingDuration 필요
     * @param revocable      회수 가능 여부
     */
    function createSchedule(
        address beneficiary,
        uint256 totalAmount,
        uint256 startTime,
        uint256 cliffDuration,
        uint256 vestingDuration,
        bool revocable
    ) external onlyRole(SCHEDULE_MANAGER_ROLE) returns (uint256 id) {
        require(beneficiary != address(0), "Vesting: beneficiary zero");
        require(totalAmount > 0, "Vesting: amount zero");
        require(vestingDuration > 0, "Vesting: duration zero");
        require(cliffDuration <= vestingDuration, "Vesting: cliff > duration");

        id = schedules.length;
        schedules.push(Schedule({
            beneficiary: beneficiary,
            totalAmount: totalAmount,
            startTime: startTime,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            released: 0,
            revocable: revocable,
            revoked: false
        }));
        scheduleIdsOf[beneficiary].push(id);

        emit ScheduleCreated(id, beneficiary, totalAmount, startTime, cliffDuration, vestingDuration);
    }

    /// @notice schedule id의 unlock 가능 수량 (이미 인출분 제외)
    function releasable(uint256 id) public view returns (uint256) {
        Schedule storage s = schedules[id];
        if (s.revoked) return 0;
        if (block.timestamp < s.startTime + s.cliffDuration) return 0;
        uint256 elapsed = block.timestamp - s.startTime;
        if (elapsed >= s.vestingDuration) {
            return s.totalAmount - s.released;
        }
        uint256 vested = (s.totalAmount * elapsed) / s.vestingDuration;
        return vested - s.released;
    }

    /// @notice 본인 schedule의 unlock분 인출
    function release(uint256 id) external nonReentrant {
        Schedule storage s = schedules[id];
        require(s.beneficiary == msg.sender, "Vesting: not beneficiary");
        uint256 amt = releasable(id);
        require(amt > 0, "Vesting: nothing to release");
        s.released += amt;
        czm.safeTransfer(s.beneficiary, amt);
        emit Released(id, s.beneficiary, amt);
    }

    /// @notice 본인의 모든 schedule 일괄 인출
    function releaseAll() external nonReentrant {
        uint256[] memory ids = scheduleIdsOf[msg.sender];
        uint256 total;
        for (uint i = 0; i < ids.length; i++) {
            Schedule storage s = schedules[ids[i]];
            uint256 amt = releasable(ids[i]);
            if (amt > 0) {
                s.released += amt;
                total += amt;
                emit Released(ids[i], msg.sender, amt);
            }
        }
        require(total > 0, "Vesting: nothing to release");
        czm.safeTransfer(msg.sender, total);
    }

    /// @notice revocable schedule 회수 (관리자만). 이미 vested된 분은 beneficiary에 인도.
    function revoke(uint256 id) external onlyRole(SCHEDULE_MANAGER_ROLE) nonReentrant {
        Schedule storage s = schedules[id];
        require(s.revocable, "Vesting: not revocable");
        require(!s.revoked, "Vesting: already revoked");

        // pay out vested portion to beneficiary
        uint256 vested = releasable(id);
        if (vested > 0) {
            s.released += vested;
            czm.safeTransfer(s.beneficiary, vested);
            emit Released(id, s.beneficiary, vested);
        }

        // remaining returns to admin (treasury)
        uint256 remaining = s.totalAmount - s.released;
        s.revoked = true;
        if (remaining > 0) {
            czm.safeTransfer(msg.sender, remaining);
        }
        emit ScheduleRevoked(id, remaining);
    }

    function getScheduleCount() external view returns (uint256) {
        return schedules.length;
    }
}
