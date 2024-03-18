# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```

# Notes

## 20240303
+ installed typechain 
+ whenever some changes or fix on any contracts, dont forget to call `npx hardhat compile`, with hardhat-typechain, it also generate source code that wrap contract into typescript. And it requires, code update in the backend folder as well. Get into `tool/` folder, and run `make compile-and-deliver-artifact-and-typechain`

## 20230709

+ import Evermoon (EVM Token) and EvermoonAsset (EVM NFT) into project
+ rewrite script for deploying Sacred Egg, Beast
+ write new script for deploying Skin

## 20230514

deployed EVM Token for development (named EVMDevToken) and verified

address: 0x1aF120395AE7835A581b28fAA0e46EbA0121b2b3
url: https://goerli.etherscan.io/address/0x1aF120395AE7835A581b28fAA0e46EbA0121b2b3#code

--------------------------------

## 20230504

register IMX user with wallet address: `0xA9e59fc83739309BAf798851bE870b47B1F09516`

imx user ID: `0x020d243da24321e46e6b3d3ce5209a4da7bdb44dded4a733eb9c55a7bd46d72a`
result file: tool/cmd/out/imx/user-registration/1683124887208-hardhat/result.json

--------------------------------

create imx project id: `9782`
result file: tool/cmd/out/imx/create-project/1683134379862-hardhat/result.json

--------------------------------

deploy SacredEgg on Goerli (imx sandbox)
+ address: `0xa02a0f33c4f14d9d154cd584c8cd51e204aeba33`
+ url: https://goerli.etherscan.io/address/0xa02a0f33c4f14d9d154cd584c8cd51e204aeba33

--------------------------------

## 20230528

deploy SacredBeast on Goerli (imx sandbox)
+ address: `0x904fFa553a4DC976a0ccC9388fB705d588FCE54A`
+ url: https://goerli.etherscan.io/address/0x904fFa553a4DC976a0ccC9388fB705d588FCE54A

create sacred beast collection on imx
+ in directory tool/cmd/ with command: make imx-create-collection-sacredbeast-sandbox
+ output file: tool/cmd/out/imx/create-collection-sacredbeast/1685263230148-hardhat/result.json

added metadata for sacred beast collection ..done

