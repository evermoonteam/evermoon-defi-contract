// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Token Vesting
 * @dev Manages a vesting schedule for ERC20 tokens. Allows tokens to be vested and released according to a predefined schedule.
 */
contract TokenVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        // Address eligible to receive the tokens once they become vested.
        address beneficiary;
        // Timestamp in seconds since the UNIX epoch when the cliff period ends. The beneficiary cannot receive any tokens before this time.
        uint256 cliff;
        // Timestamp of the beginning of the vesting period, in seconds since the UNIX epoch.
        uint256 start;
        // Total time in seconds that the vesting period lasts. After this duration from the start time, all tokens are fully vested.
        uint256 vestingDuration;
        // Interval in seconds between the vesting events or periods when a portion of the tokens becomes vested and potentially releasable.
        uint256 vestingInterval;
        // The total number of tokens that will be vested and released to the beneficiary by the end of the vesting period.
        uint256 totalAmount;
        // The amount of tokens that have been released to the beneficiary up to the current point in time.
        uint256 releasedAmount;
        // Indicates if the vesting schedule can be revoked by the issuer, allowing no further vesting or release of tokens.
        bool revocable;
        // Tracks whether the vesting has been revoked. If true, no further tokens will be vested or released.
        bool revoked;
    }

    // The token address
    address public immutable token;

    bytes32[] private scheduleIds;
    mapping(bytes32 => VestingSchedule) private vestingSchedules;

    // Total amount of tokens managed by the vesting contract
    uint256 public totalAmount;
    // Number of vesting schedules associated to a beneficiary
    mapping(address => uint256) private holdersVestingCount;

    /**
     * @dev Reverts if the vesting has been revoked.
     */
    modifier onlyIfNotRevoked(bytes32 _scheduleId) {
        require(!vestingSchedules[_scheduleId].revoked);
        _;
    }

    event VestingScheduleCreated(
        bytes32 indexed scheduleId,
        address indexed beneficiary,
        uint256 start,
        uint256 cliff,
        uint256 duration,
        uint256 interval,
        uint256 amount,
        bool revocable
    );

    event TokensReleased(bytes32 indexed scheduleId, uint256 amount);
    event VestingRevoked(bytes32 indexed scheduleId);

    /**
     * @dev Creates a vesting contract.
     * @param _token address of the ERC20 token contract
     */
    constructor(address _token) Ownable(msg.sender) {
        // Check that the token address is not 0x0.
        require(_token != address(0x0));
        token = _token;
    }

    /**
     * @notice Creates a new vesting schedule for a beneficiary.
     * @dev Adds a new vesting schedule to the contract. Vesting schedules are identified by a unique ID. Only the owner can create a vesting schedule.
     * @param _beneficiary The address of the beneficiary to whom vested tokens are transferred
     * @param _start The start time of the vesting period, as a UNIX timestamp.
     * @param _cliffDuration Duration of the cliff period in seconds, during which no tokens can be released.
     * @param _vestingDuration Total duration of the vesting period in seconds.
     * @param _vestingInterval The interval in seconds between vesting points.
     * @param _revocable Indicates if the vesting can be revoked.
     * @param _amount The total amount of tokens to be vested.
     */
    function createVestingSchedule(
        address _beneficiary,
        uint256 _start,
        uint256 _cliffDuration,
        uint256 _vestingDuration,
        uint256 _vestingInterval,
        bool _revocable,
        uint256 _amount
    ) external onlyOwner {
        require(
            getWithdrawableAmount() >= _amount,
            "TokenVesting: cannot create vesting schedule because not sufficient tokens"
        );
        require(
            _vestingDuration > 0,
            "TokenVesting: vestingDuration must be > 0"
        );
        require(_amount > 0, "TokenVesting: amount must be > 0");
        require(
            _vestingInterval >= 1,
            "TokenVesting: vesting interval must be >= 1"
        );
        require(
            _vestingDuration >= _cliffDuration,
            "TokenVesting: vesting duration must be >= cliff duration"
        );
        bytes32 scheduleId = getScheduleId(_beneficiary);
        uint256 cliff = _start + _cliffDuration;
        vestingSchedules[scheduleId] = VestingSchedule(
            _beneficiary,
            cliff,
            _start,
            _vestingDuration,
            _vestingInterval,
            _amount,
            0,
            _revocable,
            false
        );
        totalAmount = totalAmount + _amount;
        scheduleIds.push(scheduleId);
        uint256 currentVestingCount = holdersVestingCount[_beneficiary];
        holdersVestingCount[_beneficiary] = currentVestingCount + 1;

        emit VestingScheduleCreated(
            scheduleId,
            _beneficiary,
            _start,
            _start + _cliffDuration,
            _vestingDuration,
            _vestingInterval,
            _amount,
            _revocable
        );
    }

    /**
     * @notice Revokes a vesting schedule.
     * @param _scheduleId Identifier of the vesting schedule to be revoked.
     */
    function revoke(
        bytes32 _scheduleId
    ) external onlyOwner onlyIfNotRevoked(_scheduleId) {
        VestingSchedule storage vestingSchedule = vestingSchedules[_scheduleId];
        require(
            vestingSchedule.revocable,
            "TokenVesting: vesting is not revocable"
        );
        vestingSchedule.revoked = true;
        uint256 vestedAmount = _releasableAmount(vestingSchedule);
        if (vestedAmount > 0) {
            release(_scheduleId, vestedAmount);
        }
        uint256 unreleased = vestingSchedule.totalAmount -
            vestingSchedule.releasedAmount;
        totalAmount = totalAmount - unreleased;

        emit VestingRevoked(_scheduleId);
    }

    /**
     * @notice Withdraws a specific amount of tokens from the contract.
     * @dev Can only be called by the owner. Amount must be less than or equal to the withdrawable amount.
     * @param amount The amount of tokens to withdraw.
     */
    function withdraw(uint256 amount) external nonReentrant onlyOwner {
        require(
            getWithdrawableAmount() >= amount,
            "TokenVesting: not enough withdrawable funds"
        );

        IERC20(token).safeTransfer(msg.sender, amount);
    }

    /**
     * @notice Releases vested tokens from a specific vesting schedule.
     * @dev Can be called by the beneficiary or the owner. The amount of tokens to be released must be less than or equal to the releasable amount.
     * @param _scheduleId Identifier of the vesting schedule.
     * @param amount The amount of tokens to release.
     */
    function release(
        bytes32 _scheduleId,
        uint256 amount
    ) public nonReentrant onlyIfNotRevoked(_scheduleId) {
        VestingSchedule storage vestingSchedule = vestingSchedules[_scheduleId];
        bool isBeneficiary = msg.sender == vestingSchedule.beneficiary;

        bool isOwner = (msg.sender == owner());
        require(
            isBeneficiary || isOwner,
            "TokenVesting: only beneficiary and owner can release vested tokens"
        );
        uint256 vestedAmount = _releasableAmount(vestingSchedule);
        require(
            vestedAmount >= amount,
            "TokenVesting: cannot release tokens, not enough vested tokens"
        );
        vestingSchedule.releasedAmount =
            vestingSchedule.releasedAmount +
            amount;
        address payable beneficiaryPayable = payable(
            vestingSchedule.beneficiary
        );
        totalAmount = totalAmount - amount;
        IERC20(token).safeTransfer(beneficiaryPayable, amount);

        emit TokensReleased(_scheduleId, amount);
    }

    /**
     * @notice Returns the number of vesting schedules a beneficiary has.
     * @return The number of vesting schedules associated with the beneficiary.
     */
    function getVestingSchedulesCountByBeneficiary(
        address _beneficiary
    ) external view returns (uint256) {
        return holdersVestingCount[_beneficiary];
    }

    /**
     * @notice Retrieves the vesting schedule identifier at a specific index.
     * @return The identifier of the vesting schedule at the specified index.
     */
    function getScheduleIdAtIndex(
        uint256 index
    ) external view returns (bytes32) {
        require(
            index < getVestingSchedulesCount(),
            "TokenVesting: index out of bounds"
        );
        return scheduleIds[index];
    }

    /**
     * @notice Returns the vesting schedule for a given holder and index.
     * @return The vesting schedule corresponding to the given holder and index.
     */
    function getVestingScheduleByAddressAndIndex(
        address holder,
        uint256 index
    ) external view returns (VestingSchedule memory) {
        return
            getVestingSchedule(
                getVestingScheduleIdForAddressAndIndex(holder, index)
            );
    }

    /**
     * @notice Returns the total number of vesting schedules managed by the contract.
     * @return The total number of vesting schedules.
     */
    function getVestingSchedulesCount() public view returns (uint256) {
        return scheduleIds.length;
    }

    /**
     * @notice Calculate the vested amount of tokens for the given vesting schedule identifier.
     * @return The amount of tokens that can be released.
     */
    function releasableAmount(
        bytes32 _scheduleId
    ) external view onlyIfNotRevoked(_scheduleId) returns (uint256) {
        VestingSchedule storage vestingSchedule = vestingSchedules[_scheduleId];
        return _releasableAmount(vestingSchedule);
    }

    /**
     * @notice Returns the vesting schedule information for a given identifier.
     * @return The vesting schedule struct information.
     */
    function getVestingSchedule(
        bytes32 _scheduleId
    ) public view returns (VestingSchedule memory) {
        return vestingSchedules[_scheduleId];
    }

    /**
     * @notice Calculates the amount of tokens that can currently be withdrawn by the owner.
     * @return The amount of tokens that can be withdrawn.
     */
    function getWithdrawableAmount() public view returns (uint256) {
        return IERC20(token).balanceOf(address(this)) - totalAmount;
    }

    /**
     * @dev Generates a unique identifier for a vesting schedule based on the beneficiary's address and the number of schedules already created for them.
     * @return A unique vesting schedule identifier.
     */
    function getScheduleId(address holder) public view returns (bytes32) {
        return
            getVestingScheduleIdForAddressAndIndex(
                holder,
                holdersVestingCount[holder]
            );
    }

    /**
     * @notice Retrieves the last vesting schedule created for a given holder.
     * @return The last vesting schedule created for the specified holder.
     */
    function getLastVestingScheduleForHolder(
        address holder
    ) external view returns (VestingSchedule memory) {
        return
            vestingSchedules[
                getVestingScheduleIdForAddressAndIndex(
                    holder,
                    holdersVestingCount[holder] - 1
                )
            ];
    }

    /**
     * @dev Calculates a unique identifier for a vesting schedule based on a holder's address and an index.
     * @return A unique identifier for the vesting schedule.
     */
    function getVestingScheduleIdForAddressAndIndex(
        address holder,
        uint256 index
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(holder, index));
    }

    /**
     * @dev Calculates the releasable amount of tokens for a given vesting schedule. This internal function considers the vesting schedule's current state.
     * @return The amount of tokens that can be released.
     */
    function _releasableAmount(
        VestingSchedule memory vestingSchedule
    ) internal view returns (uint256) {
        // Retrieve the current time.
        uint256 currentTime = getCurrentTime();
        // If the current time is before the cliff, no tokens are releasable.
        if ((currentTime < vestingSchedule.cliff) || vestingSchedule.revoked) {
            return 0;
        }
        // If the current time is after the vesting period, all tokens are releasable,
        // minus the amount already released.
        else if (
            currentTime >=
            vestingSchedule.start + vestingSchedule.vestingDuration
        ) {
            return vestingSchedule.totalAmount - vestingSchedule.releasedAmount;
        }
        // Otherwise, some tokens are releasable.
        else {
            // Calculate the number of full vesting periods that have elapsed.
            uint256 timeFromStart = currentTime - vestingSchedule.start;
            uint256 interval = vestingSchedule.vestingInterval;
            uint256 vestedPeriods = timeFromStart / interval;
            uint256 vestedSeconds = vestedPeriods * interval;
            // Calculate the amount of tokens that are vested.
            uint256 vestedAmount = (vestingSchedule.totalAmount *
                vestedSeconds) / vestingSchedule.vestingDuration;
            // Subtract the amount already released and return.
            return vestedAmount - vestingSchedule.releasedAmount;
        }
    }

    /**
     * @dev Returns the current block timestamp.
     * @return The current block timestamp as seconds since unix epoch.
     */
    function getCurrentTime() internal view virtual returns (uint256) {
        return block.timestamp;
    }
}
