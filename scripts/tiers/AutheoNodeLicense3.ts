import { ethers, upgrades } from "hardhat";
import hre from "hardhat";
import fs from "fs";

async function main() {
  const totalNodes = 100;
  const baseTokenURI = "https://axshivam.github.io/";
  const tier = "3";
  const paymentReceiver = "0x636De536d640e4d857bD62Dc40306B063fF8F8d0";
  const nodePriceInUSD = 70;

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

  const AutheoNodeLicense3 = await ethers.getContractFactory(
    "AutheoNodeLicense3"
  );

  const autheoNodeLicense3 = await AutheoNodeLicense3.deploy(
    totalNodes,
    baseTokenURI,
    tier,
    paymentReceiver,
    autheoCentralStoreContractAddress,
    nodePriceInUSD
  );

  await autheoNodeLicense3.waitForDeployment();

  const autheoNodeLicense3ContractAddress =
    await autheoNodeLicense3.getAddress();

  fs.writeFileSync(
    `constants/tiers/AutheoNodeLicense3.json`,
    `{\n "contractAddress" : "${autheoNodeLicense3ContractAddress}" \n}`
  );

  console.log(`Contract deployed to: ${autheoNodeLicense3ContractAddress}`);

  console.log("Total Nodes:", await autheoNodeLicense3.totalNodes());
  console.log("Tier:", await autheoNodeLicense3.tier());
  console.log("Unit Price:", await autheoNodeLicense3.nodePriceInUSD());
  console.log("Payment Receiver:", await autheoNodeLicense3.paymentReceiver());

  await hre.run("verify:verify", {
    address: autheoNodeLicense3ContractAddress,
    contract: "contracts/tiers/AutheoNodeLicense3.sol:AutheoNodeLicense3",
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
