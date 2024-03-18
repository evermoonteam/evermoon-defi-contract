// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./Mintable.sol";

contract EvermoonAsset is ERC721, Mintable {
    string baseURI;

    constructor(
        address _owner,
        address _imx,
        string memory _name,
        string memory _symbol,
        string memory _uri
    ) ERC721(_name, _symbol) Mintable(_owner, _imx) {
        string memory uri = string(abi.encodePacked(_uri, "/"));
        baseURI = uri;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function setBaseURI(string memory _uri) external onlyOwner {
        baseURI = _uri;
    }

    function tokenURI(
        uint256 _tokenId
    ) public view override returns (string memory) {
        require(
            _exists(_tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        // blueprints[_tokenId] stores nft's CID
        return string(abi.encodePacked(_baseURI(), blueprints[_tokenId]));
    }

    function _mintFor(
        address to,
        uint256 id,
        bytes memory
    ) internal virtual override {
        _safeMint(to, id);
    }
}
