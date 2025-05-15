import { ethers, upgrades } from "hardhat";
import hre from "hardhat";
import fs from "fs";

async function main() {
  const totalNodes = 100;
  const baseTokenURI = "https://axshivam.github.io/";
  const tier = "4";
  const paymentReceiver = "0x636De536d640e4d857bD62Dc40306B063fF8F8d0";
  const nodePriceInUSD = 80;

  let autheoCentralStoreContractAddress = fs.readFileSync(
    "constants/AutheoCentralStore.json",
    "utf-8"
  );
  autheoCentralStoreContractAddress = JSON.parse(
    autheoCentralStoreContractAddress
  ).contractAddress;
  console.log(
    "AutheoCentralStore Contract Address:",
    autheoCentralStoreContractAddress
  );

  const AutheoNodeLicense4 = await ethers.getContractFactory(
    "AutheoNodeLicense4"
  );

  const autheoNodeLicense4 = await AutheoNodeLicense4.deploy(
    totalNodes,
    baseTokenURI,
    tier,
    paymentReceiver,
    autheoCentralStoreContractAddress,
    nodePriceInUSD
  );

  await autheoNodeLicense4.waitForDeployment();

  const autheoNodeLicense4ContractAddress =
    await autheoNodeLicense4.getAddress();

  fs.writeFileSync(
    `constants/tiers/AutheoNodeLicense4.json`,
    `{\n "contractAddress" : "${autheoNodeLicense4ContractAddress}" \n}`
  );

  console.log(`Contract deployed to: ${autheoNodeLicense4ContractAddress}`);

  console.log("Total Nodes:", await autheoNodeLicense4.totalNodes());
  console.log("Tier:", await autheoNodeLicense4.tier());
  console.log("Unit Price:", await autheoNodeLicense4.nodePriceInUSD());
  console.log("Payment Receiver:", await autheoNodeLicense4.paymentReceiver());

  await hre.run("verify:verify", {
    address: autheoNodeLicense4ContractAddress,
    contract: "contracts/tiers/AutheoNodeLicense4.sol:AutheoNodeLicense4",
    constructorArguments: [
      totalNodes,
      baseTokenURI,
      tier,
      paymentReceiver,
      autheoCentralStoreContractAddress,
      nodePriceInUSD,
    ],
  });
}

main();
