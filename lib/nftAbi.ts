import { parseAbi } from "viem";

export const MEMBER_CARD_NFT_ABI = parseAbi([
  "function mint(string metadataURI) returns (uint256 tokenId)",
  "function nextTokenId() view returns (uint256)",
  "event MemberCardMinted(address indexed minter, uint256 indexed tokenId, string tokenURI)",
]);
