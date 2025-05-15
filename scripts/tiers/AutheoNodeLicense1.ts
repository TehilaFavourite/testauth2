import { ethers, upgrades } from "hardhat";
import hre from "hardhat";
import fs from "fs";

async function main() {
  const totalNodes = 100;
  const baseTokenURI = "https://axshivam.github.io/";
  const tier = "1";
  const paymentReceiver = "0x636De536d640e4d857bD62Dc40306B063fF8F8d0";
  const nodePriceInUSD = 50;

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

  const AutheoNodeLicense1 = await ethers.getContractFactory(
    "AutheoNodeLicense1"
  );

  const autheoNodeLicense1 = await AutheoNodeLicense1.deploy(
    totalNodes,
    baseTokenURI,
    tier,
    paymentReceiver,
    autheoCentralStoreContractAddress,
    nodePriceInUSD
  );

  await autheoNodeLicense1.waitForDeployment();

  const autheoNodeLicense1ContractAddress =
    await autheoNodeLicense1.getAddress();

  fs.writeFileSync(
    `constants/tiers/AutheoNodeLicense1.json`,
    `{\n "contractAddress" : "${autheoNodeLicense1ContractAddress}" \n}`
  );

  console.log(`Contract deployed to: ${autheoNodeLicense1ContractAddress}`);

  console.log("Total Nodes:", await autheoNodeLicense1.totalNodes());
  console.log("Tier:", await autheoNodeLicense1.tier());
  console.log("Unit Price:", await autheoNodeLicense1.nodePriceInUSD());
  console.log("Payment Receiver:", await autheoNodeLicense1.paymentReceiver());

  await hre.run("verify:verify", {
    address: autheoNodeLicense1ContractAddress,
    contract: "contracts/tiers/AutheoNodeLicense1.sol:AutheoNodeLicense1",
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
