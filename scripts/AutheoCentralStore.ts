import { ethers, upgrades } from "hardhat";
import hre from "hardhat";
import fs from "fs";

async function main() {
  // for ethereum sapolia testnet

  const priceFeedContract = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
  const usdcSmartContract = "0x832DaaF45A27760D32A8cc2313CeDdd7536E9214";
  const usdtSmartContract = "0xda20BbC232e3BB3EdC716A7D4d37c019DE0f5284";
  const referredCommisionPercentage = 15;
  const referrerCommissionPercentage = 10;
  const perUserCap = 1;
  const internalWalletMaxHoldings = 5;

  const AutheoCentralStore = await ethers.getContractFactory(
    "AutheoCentralStore"
  );
  const autheoCentralStore = await upgrades.deployProxy(
    AutheoCentralStore,
    [
      priceFeedContract,
      usdtSmartContract,
      usdcSmartContract,
      referredCommisionPercentage,
      referrerCommissionPercentage,
      perUserCap,
      internalWalletMaxHoldings,
    ],
    {
      initializer: "initialize",
    }
  );

  await autheoCentralStore.waitForDeployment();

  const autheoCentralStoreContractAddress =
    await autheoCentralStore.getAddress();

  fs.writeFileSync(
    `constants/AutheoCentralStore.json`,
    `{\n "contractAddress" : "${autheoCentralStoreContractAddress}" \n}`
  );

  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    autheoCentralStoreContractAddress
  );

  fs.writeFileSync(
    `constants/implementation/AutheoCentralStore.json`,
    `{\n "contractAddress" : "${implementationAddress}" \n}`
  );

  console.log(`Contract deployed to: ${autheoCentralStoreContractAddress}`);
  console.log("SuperAdmin:", await autheoCentralStore.superAdmin());
  console.log(
    "Contract Version:",
    await autheoCentralStore.getContractVersion()
  );
  console.log(
    "USDT Support:",
    await autheoCentralStore.supportedTokens(usdtSmartContract)
  );

  await hre.run("verify:verify", {
    address: autheoCentralStoreContractAddress,
    contract: "contracts/AutheoCentralStore.sol:AutheoCentralStore",
    constructorArguments: [],
  });
}

main();
