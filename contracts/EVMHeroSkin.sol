// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./Mintable.sol";
import "./EvermoonAsset.sol";

contract EVMHeroSkin is EvermoonAsset {
    constructor(
        address _owner,
        address _imx,
        string memory _uri
    ) EvermoonAsset(_owner, _imx, "Evermoon Hero Skin", "EVM-SKIN", _uri) {}
}
