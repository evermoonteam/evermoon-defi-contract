// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./EvermoonBridgeToken.sol";

contract EVMBridgeLocker is AccessControl {
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");

    EvermoonBridgeToken public token;

    event Lock(address indexed sender, uint256 amount, address target);
    event Unlock(address indexed sender, uint256 amount);

    constructor(address _owner, address _token) {
        _grantRole(OWNER_ROLE, _owner);
        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        require(_owner != address(0), "_owner must not be zero address");
        require(_token != address(0), "_token must not be zero address");
        token = EvermoonBridgeToken(_token);
    }

    function lockToken(
        address target,
        uint256 amount
    ) external onlyRole(OWNER_ROLE) {
        token.mint(target, amount);
        emit Lock(msg.sender, amount, target);
    }

    function unlockToken(uint256 amount) external {
        require(token.balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        token.burn(address(this), amount);
        emit Unlock(msg.sender, amount);
    }
}
