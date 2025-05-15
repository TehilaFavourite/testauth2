import { ethers, upgrades } from "hardhat";
import hre from "hardhat";
import fs from "fs";

async function main() {
  const totalNodes = 100;
  const baseTokenURI = "https://axshivam.github.io/";
  const tier = "2";
  const paymentReceiver = "0x636De536d640e4d857bD62Dc40306B063fF8F8d0";
  const nodePriceInUSD = 60;

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

  const AutheoNodeLicense2 = await ethers.getContractFactory(
    "AutheoNodeLicense2"
  );

  const autheoNodeLicense2 = await AutheoNodeLicense2.deploy(
    totalNodes,
    baseTokenURI,
    tier,
    paymentReceiver,
    autheoCentralStoreContractAddress,
    nodePriceInUSD
  );

  await autheoNodeLicense2.waitForDeployment();

  const autheoNodeLicense2ContractAddress =
    await autheoNodeLicense2.getAddress();

  fs.writeFileSync(
    `constants/tiers/AutheoNodeLicense2.json`,
    `{\n "contractAddress" : "${autheoNodeLicense2ContractAddress}" \n}`
  );

  console.log(`Contract deployed to: ${autheoNodeLicense2ContractAddress}`);

  console.log("Total Nodes:", await autheoNodeLicense2.totalNodes());
  console.log("Tier:", await autheoNodeLicense2.tier());
  console.log("Unit Price:", await autheoNodeLicense2.nodePriceInUSD());
  console.log("Payment Receiver:", await autheoNodeLicense2.paymentReceiver());

  await hre.run("verify:verify", {
    address: autheoNodeLicense2ContractAddress,
    contract: "contracts/tiers/AutheoNodeLicense2.sol:AutheoNodeLicense2",
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
