import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import etherscanCredential from "./.credential/.etherscan.json";

import networkDev from "./.network-config/dev.json";
import networkSandbox from "./.network-config/sandbox.json";
import networkGoerli from "./.network-config/goerli.json";
import networkSepolia from "./.network-config/sepolia.json";
import networkBNBTestnet from "./.network-config/bnb-testnet.json";
import networkMainnet from "./.network-config/mainnet.json";

import "hardhat-change-network";
import "hardhat-contract-sizer";

import "./task/flatten2";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",

  networks: {
    dev: {
      ...networkDev,
    },
    sandbox: {
      ...networkSandbox,
    },
    goerli: {
      ...networkGoerli,
    },
    sepolia: {
      ...networkSepolia,
    },
    bnbTestnet: {
      ...networkBNBTestnet,
    },
    forkedGoerli: {
      ...networkGoerli,
      url: "http://127.0.0.1:8545"
    },
    forkedSepolia: {
      ...networkSepolia,
      url: "http://127.0.0.1:8545"
    },
    forkedBNBTestnet: {
      ...networkBNBTestnet,
      url: "http://127.0.0.1:8545"
    }
    // mainnet: {
    //   ...networkMainnet,
    // },
  },

  etherscan: {
    apiKey: etherscanCredential.apiKey,
  },

  typechain: {
    outDir: "artifacts/typechain",
    target: "ethers-v5",
  },

  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ]
  },

  contractSizer: {
    alphaSort: false,
    runOnCompile: true,
    disambiguatePaths: false,
  },
};

export default config;
