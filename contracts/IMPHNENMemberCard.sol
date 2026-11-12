// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title IMPHNEN Member Card
/// @notice Free public mint. Each minter pays only the BNB Smart Chain transaction gas.
contract IMPHNENMemberCard is ERC721, ERC721URIStorage {
    uint256 public nextTokenId = 1;

    event MemberCardMinted(address indexed minter, uint256 indexed tokenId, string tokenURI);

    error EmptyTokenURI();

    constructor() ERC721("IMPHNEN Member Card", "IMPHNEN") {}

    function mint(string calldata metadataURI) external returns (uint256 tokenId) {
        if (bytes(metadataURI).length == 0) revert EmptyTokenURI();

        tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, metadataURI);

        emit MemberCardMinted(msg.sender, tokenId, metadataURI);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
