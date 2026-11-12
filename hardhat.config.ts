import { configVariable, defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: "0.8.28",
  chainDescriptors: {
    56: {
      name: "BNB Smart Chain",
      blockExplorers: {
        etherscan: {
          name: "BscScan",
          url: "https://bscscan.com",
          apiUrl: "https://api.etherscan.io/v2/api?chainid=56",
        },
      },
    },
    97: {
      name: "BNB Smart Chain Testnet",
      blockExplorers: {
        etherscan: {
          name: "BscScan Testnet",
          url: "https://testnet.bscscan.com",
          apiUrl: "https://api.etherscan.io/v2/api?chainid=97",
        },
      },
    },
  },
  verify: {
    etherscan: { apiKey: configVariable("BSCSCAN_API_KEY") },
    sourcify: { enabled: true },
  },
  networks: {
    bscMainnet: {
      type: "http",
      chainType: "generic",
      chainId: 56,
      url: configVariable("BSC_MAINNET_RPC_URL"),
      accounts: [configVariable("BSC_DEPLOYER_PRIVATE_KEY")],
    },
    bscTestnet: {
      type: "http",
      chainType: "generic",
      chainId: 97,
      url: configVariable("BSC_TESTNET_RPC_URL"),
      accounts: [configVariable("BSC_DEPLOYER_PRIVATE_KEY")],
    },
  },
});
