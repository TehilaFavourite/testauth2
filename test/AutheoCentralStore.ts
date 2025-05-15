// @ts-nocheck

const { expect } = require("chai");
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("Autheo Central Store Smart Contract", function () {
  async function contractDeployment() {
    const [owner, account, test, paymentReceiver] = await ethers.getSigners();

    const MockOracle = await ethers.getContractFactory("MockOracle");
    const mockOracle = await MockOracle.deploy();
    const mockOracleContractAddress = await mockOracle.getAddress();

    // deployment of tokens
    const USDTToken = await ethers.getContractFactory("USDTToken");
    const usdtToken = await USDTToken.deploy();
    const usdtTokenContractAddress = await usdtToken.getAddress();

    const USDCToken = await ethers.getContractFactory("USDCToken");
    const usdcToken = await USDCToken.deploy();
    const usdcTokenContractAddress = await usdcToken.getAddress();

    const AutheoCentralStore = await ethers.getContractFactory(
      "AutheoCentralStore"
    );
    const autheoCentralStore = await upgrades.deployProxy(
      AutheoCentralStore,
      [
        mockOracleContractAddress,
        usdtTokenContractAddress,
        usdcTokenContractAddress,
        10,
        10,
        100,
        5,
      ],
      {
        initializer: "initialize",
      }
    );

    const proxyContractAddress = await autheoCentralStore.getAddress();
    const implemetationAddress =
      await upgrades.erc1967.getImplementationAddress(proxyContractAddress);

    return {
      owner,
      account,
      test,
      paymentReceiver,
      autheoCentralStore,
      mockOracle,
      proxyContractAddress,
      implemetationAddress,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      mockOracleContractAddress,
    };
  }
  it("Initial State", async function () {
    const {
      owner,
      autheoCentralStore,
      account,
      usdtTokenContractAddress,
      usdcTokenContractAddress,
      mockOracleContractAddress,
    } = await loadFixture(contractDeployment);

    expect(await autheoCentralStore.superAdmin()).to.be.equal(owner.address);

    expect(await autheoCentralStore.isAdmin(owner.address)).to.be.equal(true);

    expect(await autheoCentralStore.isAdmin(account.address)).to.be.equal(
      false
    );

    expect(await autheoCentralStore.isBlackListed(owner.address)).to.be.equal(
      false
    );
    expect(await autheoCentralStore.isBlackListed(account.address)).to.be.equal(
      false
    );
    expect(await autheoCentralStore.isKYC(owner.address)).to.be.equal(false);
    expect(await autheoCentralStore.isKYC(account.address)).to.be.equal(false);

    expect(await autheoCentralStore.isActiveReferral("axshivam")).to.be.equal(
      false
    );
    expect(
      await autheoCentralStore.referralCodeToAddress("axshivam")
    ).to.be.equal("0x0000000000000000000000000000000000000000");
    expect(await autheoCentralStore.isActiveReferral("")).to.be.equal(false);
    expect(await autheoCentralStore.referralCodeToAddress("")).to.be.equal(
      "0x0000000000000000000000000000000000000000"
    );

    expect(
      await autheoCentralStore.addressToReferralCode(owner.address)
    ).to.be.equal("");
    expect(
      await autheoCentralStore.addressToReferralCode(account.address)
    ).to.be.equal("");

    expect(await autheoCentralStore.userHoldings(owner.address)).to.be.equal(0);
    expect(await autheoCentralStore.userHoldings(account.address)).to.be.equal(
      0
    );

    expect(await autheoCentralStore.referredCommissionPercentage()).to.be.equal(
      10
    );
    expect(await autheoCentralStore.referrerCommissionPercentage()).to.be.equal(
      10
    );

    expect(
      await autheoCentralStore.whitelistedTierContracts(
        "0x0000000000000000000000000000000000000000"
      )
    ).to.be.equal(false);
    expect(
      await autheoCentralStore.whitelistedTierContracts(owner.address)
    ).to.be.equal(false);

    expect(await autheoCentralStore.supportedTokens(owner.address)).to.be.equal(
      false
    );
    expect(
      await autheoCentralStore.supportedTokens(usdcTokenContractAddress)
    ).to.be.equal(true);
    expect(
      await autheoCentralStore.supportedTokens(usdtTokenContractAddress)
    ).to.be.equal(true);

    expect(await autheoCentralStore.ethUsdPriceFeed()).to.be.equal(
      mockOracleContractAddress
    );

    expect(await autheoCentralStore.getContractVersion()).to.be.equal("0.0.1");

    expect(
      await autheoCentralStore.internalAccounts(owner.address)
    ).to.be.equal(false);
    expect(
      await autheoCentralStore.internalAccounts(account.address)
    ).to.be.equal(false);
    expect(await autheoCentralStore.internalWalletMaxHoldings()).to.be.equal(5);
  });
  it("Oracles", async function () {
    const { owner, account, autheoCentralStore, mockOracle } =
      await loadFixture(contractDeployment);

    expect(await autheoCentralStore.getLatestEthPriceInUsd()).to.be.equal(
      375842930000
    );
    expect(await autheoCentralStore.getUsdPriceInEth()).to.be.equal(
      266068594133192
    );

    await mockOracle.updateAnswer(1000);
    expect(await autheoCentralStore.getLatestEthPriceInUsd()).to.be.equal(1000);
    expect(await autheoCentralStore.getUsdPriceInEth()).to.be.equal(
      100000000000000000000000n
    );
    expect(await autheoCentralStore.isContract(owner.address)).to.be.equal(
      false
    );
    expect(await autheoCentralStore.getContractVersion()).to.be.equal("0.0.1");
  });
  it("transferSuperAdmin", async function () {
    const { owner, autheoCentralStore, test, account } = await loadFixture(
      contractDeployment
    );
    await expect(
      autheoCentralStore.connect(account).transferSuperAdmin(test.address)
    ).to.be.revertedWith(
      "Unauthorized! Only super admin can perform this operation"
    );

    await expect(
      autheoCentralStore
        .connect(owner)
        .transferSuperAdmin("0x0000000000000000000000000000000000000000")
    ).to.be.revertedWith("Not a valid address");

    await expect(
      autheoCentralStore.connect(owner).transferSuperAdmin(test.address)
    )
      .to.emit(autheoCentralStore, "SuperAdminUpdated")
      .withArgs(test.address, owner.address);

    expect(await autheoCentralStore.superAdmin()).to.be.equal(test.address);

    await expect(
      autheoCentralStore.connect(owner).transferSuperAdmin(account.address)
    ).to.be.revertedWith(
      "Unauthorized! Only super admin can perform this operation"
    );
    await autheoCentralStore.connect(test).transferSuperAdmin(owner.address);
    expect(await autheoCentralStore.superAdmin()).to.be.equal(owner.address);
  });
  it("updateAdminRole", async function () {
    const { owner, autheoCentralStore, test, account } = await loadFixture(
      contractDeployment
    );

    expect(await autheoCentralStore.isAdmin(owner.address)).to.be.equal(true);
    expect(await autheoCentralStore.isAdmin(account.address)).to.be.equal(
      false
    );

    await expect(
      autheoCentralStore.connect(account).updateAdminRole(account.address, true)
    ).to.be.revertedWith(
      "Unauthorized! Only super admin can perform this operation"
    );

    await expect(
      autheoCentralStore.updateAdminRole(
        "0x0000000000000000000000000000000000000000",
        true
      )
    ).to.be.revertedWith("Not a valid address");

    await autheoCentralStore.updateAdminRole(account.address, true);
    expect(await autheoCentralStore.isAdmin(account.address)).to.be.equal(true);

    await expect(autheoCentralStore.updateAdminRole(account.address, false))
      .to.emit(autheoCentralStore, "AdminUpdated")
      .withArgs(account.address, false);

    expect(await autheoCentralStore.isAdmin(account.address)).to.be.equal(
      false
    );
  });
  it("generateReferralCode", async function () {
    const { owner, autheoCentralStore, test, account } = await loadFixture(
      contractDeployment
    );

    const referralCode = "REFCODE";

    expect(
      await autheoCentralStore.referralCodeToAddress(referralCode)
    ).to.be.equal("0x0000000000000000000000000000000000000000");
    expect(
      await autheoCentralStore.addressToReferralCode(owner.address)
    ).to.equal("");
    expect(await autheoCentralStore.isActiveReferral(referralCode)).to.be.equal(
      false
    );

    await expect(
      autheoCentralStore.generateReferralCode("")
    ).to.be.revertedWith("Invalid referral code");

    console.log("1");

    await expect(
      autheoCentralStore.generateReferralCode("      ")
    ).to.be.revertedWith("ReferralCode cannot contain spaces");

    console.log("2");

    await expect(
      autheoCentralStore.generateReferralCode(" t    ")
    ).to.be.revertedWith("ReferralCode cannot contain spaces");

    await expect(
      autheoCentralStore.generateReferralCode("Shiv Sharm")
    ).to.be.revertedWith("ReferralCode cannot contain spaces");

    expect(await autheoCentralStore.isBlackListed(owner.address)).to.be.equal(
      false
    );

    await autheoCentralStore.updateBlackListUser(owner.address, true);

    expect(await autheoCentralStore.isBlackListed(owner.address)).to.be.equal(
      true
    );

    await expect(
      autheoCentralStore.generateReferralCode(referralCode)
    ).to.be.revertedWith("Blacklisted User");

    await autheoCentralStore.updateBlackListUser(owner.address, false);

    expect(await autheoCentralStore.isBlackListed(owner.address)).to.be.equal(
      false
    );

    await expect(
      autheoCentralStore.generateReferralCode(referralCode)
    ).to.be.revertedWith("User kyc is not valid");
    await autheoCentralStore.updateKYCStatus(owner.address, true);

    await expect(autheoCentralStore.generateReferralCode(referralCode))
      .to.emit(autheoCentralStore, "ReferralCodeGenerated")
      .withArgs(owner.address, referralCode);

    expect(
      await autheoCentralStore.referralCodeToAddress(referralCode)
    ).to.be.equal(owner.address);
    expect(
      await autheoCentralStore.addressToReferralCode(owner.address)
    ).to.equal(referralCode);
    expect(await autheoCentralStore.isActiveReferral(referralCode)).to.be.equal(
      true
    );

    const duplicateCode = "DUPCODE";

    await expect(
      autheoCentralStore.generateReferralCode(duplicateCode)
    ).to.be.revertedWith("User already generated referral code");
    expect(
      await autheoCentralStore.referralCodeToAddress(duplicateCode)
    ).to.be.equal("0x0000000000000000000000000000000000000000");
    expect(
      await autheoCentralStore.addressToReferralCode(test.address)
    ).to.equal("");
    expect(
      await autheoCentralStore.isActiveReferral(duplicateCode)
    ).to.be.equal(false);

    await expect(
      autheoCentralStore.generateReferralCode(referralCode)
    ).to.be.revertedWith("Referral code already exist");

    await autheoCentralStore.updateKYCStatus(test.address, true);
    await autheoCentralStore.connect(test).generateReferralCode(duplicateCode);
    expect(
      await autheoCentralStore.referralCodeToAddress(duplicateCode)
    ).to.be.equal(test.address);
    expect(
      await autheoCentralStore.addressToReferralCode(test.address)
    ).to.equal(duplicateCode);
    expect(
      await autheoCentralStore.isActiveReferral(duplicateCode)
    ).to.be.equal(true);

    const bigReferralCode = "REFERRALCODEBIG";

    await expect(
      autheoCentralStore.connect(account).generateReferralCode(bigReferralCode)
    ).to.be.revertedWith("Invalid referral code");
  });
  it("updateUserReferralActiveness", async function () {
    const { owner, autheoCentralStore, test, account } = await loadFixture(
      contractDeployment
    );
    const referralCode = "REFCODE";

    await expect(
      autheoCentralStore
        .connect(owner)
        .updateUserReferralActiveness(referralCode, false)
    ).to.be.revertedWith("Referral code not exist");

    await autheoCentralStore.updateKYCStatus(test.address, true);
    await autheoCentralStore.connect(test).generateReferralCode(referralCode);

    expect(
      await autheoCentralStore.addressToReferralCode(test.address)
    ).to.be.equal(referralCode);

    expect(await autheoCentralStore.isActiveReferral(referralCode)).to.be.equal(
      true
    );

    expect(
      await autheoCentralStore.referralCodeToAddress(referralCode)
    ).to.be.equal(test.address);

    await expect(
      autheoCentralStore
        .connect(account)
        .updateUserReferralActiveness(referralCode, false)
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await autheoCentralStore
      .connect(owner)
      .updateUserReferralActiveness(referralCode, false);

    expect(await autheoCentralStore.isActiveReferral(referralCode)).to.be.equal(
      false
    );

    await expect(
      autheoCentralStore
        .connect(owner)
        .updateUserReferralActiveness(referralCode, true)
    )
      .to.emit(autheoCentralStore, "ReferralCodeActivenessUpdated")
      .withArgs(referralCode, true);

    expect(await autheoCentralStore.isActiveReferral(referralCode)).to.be.equal(
      true
    );
  });
  it("updateBlackListUser", async function () {
    const { owner, autheoCentralStore, test, account } = await loadFixture(
      contractDeployment
    );

    expect(await autheoCentralStore.isBlackListed(test.address)).to.be.equal(
      false
    );

    await expect(
      autheoCentralStore
        .connect(account)
        .updateBlackListUser(test.address, true)
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await expect(
      autheoCentralStore
        .connect(owner)
        .updateBlackListUser("0x0000000000000000000000000000000000000000", true)
    ).to.be.revertedWith("Not a valid address");

    await autheoCentralStore
      .connect(owner)
      .updateBlackListUser(test.address, true);

    expect(await autheoCentralStore.isBlackListed(test.address)).to.be.equal(
      true
    );

    await expect(
      autheoCentralStore
        .connect(owner)
        .updateBlackListUser(account.address, true)
    )
      .to.emit(autheoCentralStore, "UserBlacklistedStatusUpdate")
      .withArgs(account.address, true);

    expect(await autheoCentralStore.isBlackListed(account.address)).to.be.equal(
      true
    );

    await autheoCentralStore
      .connect(owner)
      .updateBlackListUser(account.address, false);

    expect(await autheoCentralStore.isBlackListed(account.address)).to.be.equal(
      false
    );
  });
  it("updateKYCStatus", async function () {
    const { owner, autheoCentralStore, test, account } = await loadFixture(
      contractDeployment
    );

    expect(await autheoCentralStore.isKYC(test.address)).to.be.equal(false);

    await expect(
      autheoCentralStore.connect(account).updateKYCStatus(test.address, true)
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await expect(
      autheoCentralStore
        .connect(owner)
        .updateKYCStatus("0x0000000000000000000000000000000000000000", true)
    ).to.be.revertedWith("Not a valid address");

    await autheoCentralStore.connect(owner).updateKYCStatus(test.address, true);

    expect(await autheoCentralStore.isKYC(test.address)).to.be.equal(true);

    await expect(
      autheoCentralStore.connect(owner).updateKYCStatus(account.address, true)
    )
      .to.emit(autheoCentralStore, "UserKYCStatusUpdate")
      .withArgs(account.address, true);

    expect(await autheoCentralStore.isKYC(account.address)).to.be.equal(true);

    await autheoCentralStore
      .connect(owner)
      .updateKYCStatus(account.address, false);

    expect(await autheoCentralStore.isKYC(account.address)).to.be.equal(false);
  });
  it("updateReferredCommissionPercentage", async function () {
    const { owner, autheoCentralStore, test, account } = await loadFixture(
      contractDeployment
    );

    expect(await autheoCentralStore.referredCommissionPercentage()).to.be.equal(
      10
    );

    await expect(
      autheoCentralStore.connect(account).updateReferredCommissionPercentage(0)
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await expect(autheoCentralStore.updateReferredCommissionPercentage(0))
      .to.emit(autheoCentralStore, "ReferredCommissionPercentageUpdated")
      .withArgs(0);

    expect(await autheoCentralStore.referredCommissionPercentage()).to.be.equal(
      0
    );
  });
  it("updateReferrerCommisionPercentage", async function () {
    const { owner, autheoCentralStore, test, account } = await loadFixture(
      contractDeployment
    );

    expect(await autheoCentralStore.referrerCommissionPercentage()).to.be.equal(
      10
    );

    await expect(
      autheoCentralStore.connect(account).updateReferrerCommisionPercentage(0)
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await expect(autheoCentralStore.updateReferrerCommisionPercentage(0))
      .to.emit(autheoCentralStore, "ReferrerCommisionPercentageUpdated")
      .withArgs(0);

    expect(await autheoCentralStore.referrerCommissionPercentage()).to.be.equal(
      0
    );
  });
  it("addInternalAccounts", async function () {
    const {
      owner,
      autheoCentralStore,
      test,
      account,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
    } = await loadFixture(contractDeployment);

    expect(await autheoCentralStore.internalAccounts(test.address)).to.be.equal(
      false
    );
    expect(
      await autheoCentralStore.internalAccounts(owner.address)
    ).to.be.equal(false);

    await expect(
      autheoCentralStore.connect(test).addInternalAccounts([])
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await expect(
      autheoCentralStore.connect(owner).addInternalAccounts([])
    ).to.be.revertedWith("Invalid length");

    expect(
      await autheoCentralStore.internalAccounts(usdcTokenContractAddress)
    ).to.be.equal(false);
    expect(
      await autheoCentralStore.internalAccounts(usdtTokenContractAddress)
    ).to.be.equal(false);

    await autheoCentralStore
      .connect(owner)
      .addInternalAccounts([test.address, owner.address]);

    expect(await autheoCentralStore.internalAccounts(test.address)).to.be.equal(
      true
    );
    expect(
      await autheoCentralStore.internalAccounts(owner.address)
    ).to.be.equal(true);

    await expect(
      autheoCentralStore.connect(owner).addInternalAccounts([test.address])
    )
      .to.emit(autheoCentralStore, "InternalAccountsUpdate")
      .withArgs(test.address, true);
  });
  it("removeInternalAccounts", async function () {
    const {
      owner,
      autheoCentralStore,
      test,
      account,
      paymentReceiver,
      usdtTokenContractAddress,
    } = await loadFixture(contractDeployment);

    expect(await autheoCentralStore.internalAccounts(test.address)).to.be.equal(
      false
    );
    expect(
      await autheoCentralStore.internalAccounts(owner.address)
    ).to.be.equal(false);
    expect(
      await autheoCentralStore.internalAccounts(account.address)
    ).to.be.equal(false);
    expect(
      await autheoCentralStore.internalAccounts(paymentReceiver.address)
    ).to.be.equal(false);

    await autheoCentralStore
      .connect(owner)
      .addInternalAccounts([
        test.address,
        owner.address,
        account.address,
        paymentReceiver.address,
      ]);

    expect(await autheoCentralStore.internalAccounts(test.address)).to.be.equal(
      true
    );
    expect(
      await autheoCentralStore.internalAccounts(owner.address)
    ).to.be.equal(true);
    expect(
      await autheoCentralStore.internalAccounts(account.address)
    ).to.be.equal(true);
    expect(
      await autheoCentralStore.internalAccounts(paymentReceiver.address)
    ).to.be.equal(true);

    await expect(
      autheoCentralStore.connect(test).removeInternalAccounts([])
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await expect(
      autheoCentralStore.removeInternalAccounts([])
    ).to.be.revertedWith("Invalid length");

    await autheoCentralStore
      .connect(owner)
      .removeInternalAccounts([test.address, owner.address, account.address]);

    expect(await autheoCentralStore.internalAccounts(test.address)).to.be.equal(
      false
    );
    expect(
      await autheoCentralStore.internalAccounts(owner.address)
    ).to.be.equal(false);
    expect(
      await autheoCentralStore.internalAccounts(account.address)
    ).to.be.equal(false);

    await expect(
      autheoCentralStore.removeInternalAccounts([paymentReceiver.address])
    )
      .to.emit(autheoCentralStore, "InternalAccountsUpdate")
      .withArgs(paymentReceiver.address, false);

    await expect(
      autheoCentralStore.connect(owner).addInternalAccounts([test.address])
    )
      .to.emit(autheoCentralStore, "InternalAccountsUpdate")
      .withArgs(test.address, true);
  });
  it("whitelistContract", async function () {
    const {
      owner,
      autheoCentralStore,
      test,
      account,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
    } = await loadFixture(contractDeployment);

    expect(
      await autheoCentralStore.whitelistedTierContracts(test.address)
    ).to.be.equal(false);
    expect(
      await autheoCentralStore.whitelistedTierContracts(owner.address)
    ).to.be.equal(false);

    await expect(
      autheoCentralStore.connect(test).whitelistContract([])
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await expect(
      autheoCentralStore.connect(owner).whitelistContract([])
    ).to.be.revertedWith("Invalid length");

    await expect(
      autheoCentralStore.connect(owner).whitelistContract([owner.address])
    ).to.be.revertedWith("Not a contract address");

    await expect(
      autheoCentralStore.updateHoldings(test.address, 23)
    ).to.be.revertedWith("Only tier contract can perform this operation");

    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdcTokenContractAddress
      )
    ).to.be.equal(false);
    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdtTokenContractAddress
      )
    ).to.be.equal(false);

    await expect(
      autheoCentralStore
        .connect(owner)
        .whitelistContract([
          usdcTokenContractAddress,
          usdtTokenContractAddress,
          owner.address,
        ])
    ).to.be.revertedWith("Not a contract address");

    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdcTokenContractAddress
      )
    ).to.be.equal(false);
    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdtTokenContractAddress
      )
    ).to.be.equal(false);

    await autheoCentralStore
      .connect(owner)
      .whitelistContract([usdcTokenContractAddress, usdtTokenContractAddress]);

    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdcTokenContractAddress
      )
    ).to.be.equal(true);
    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdtTokenContractAddress
      )
    ).to.be.equal(true);

    await expect(
      autheoCentralStore
        .connect(owner)
        .whitelistContract([usdcTokenContractAddress])
    )
      .to.emit(autheoCentralStore, "ContractWhitelisted")
      .withArgs(usdcTokenContractAddress);
  });
  it("removeWhitelistedContract", async function () {
    const {
      owner,
      autheoCentralStore,
      test,
      account,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
    } = await loadFixture(contractDeployment);

    expect(
      await autheoCentralStore.whitelistedTierContracts(test.address)
    ).to.be.equal(false);
    expect(
      await autheoCentralStore.whitelistedTierContracts(owner.address)
    ).to.be.equal(false);

    await expect(
      autheoCentralStore.connect(test).whitelistContract([])
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await expect(
      autheoCentralStore.connect(owner).whitelistContract([])
    ).to.be.revertedWith("Invalid length");

    await expect(
      autheoCentralStore.connect(owner).whitelistContract([owner.address])
    ).to.be.revertedWith("Not a contract address");

    await expect(
      autheoCentralStore.updateHoldings(test.address, 23)
    ).to.be.revertedWith("Only tier contract can perform this operation");

    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdcTokenContractAddress
      )
    ).to.be.equal(false);
    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdtTokenContractAddress
      )
    ).to.be.equal(false);

    await expect(
      autheoCentralStore
        .connect(owner)
        .whitelistContract([
          usdcTokenContractAddress,
          usdtTokenContractAddress,
          owner.address,
        ])
    ).to.be.revertedWith("Not a contract address");

    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdcTokenContractAddress
      )
    ).to.be.equal(false);
    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdtTokenContractAddress
      )
    ).to.be.equal(false);

    await autheoCentralStore
      .connect(owner)
      .whitelistContract([usdcTokenContractAddress, usdtTokenContractAddress]);

    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdcTokenContractAddress
      )
    ).to.be.equal(true);
    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdtTokenContractAddress
      )
    ).to.be.equal(true);

    await expect(
      autheoCentralStore
        .connect(owner)
        .whitelistContract([usdcTokenContractAddress])
    )
      .to.emit(autheoCentralStore, "ContractWhitelisted")
      .withArgs(usdcTokenContractAddress);

    await expect(
      autheoCentralStore.connect(test).removeWhitelistedContract([])
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await expect(
      autheoCentralStore.connect(owner).removeWhitelistedContract([])
    ).to.be.revertedWith("Invalid length");

    await expect(
      autheoCentralStore
        .connect(owner)
        .removeWhitelistedContract([
          owner.address,
          test.address,
          account.address,
        ])
    ).to.be.revertedWith("Contract not whitelisted");

    await expect(
      autheoCentralStore
        .connect(owner)
        .removeWhitelistedContract([
          usdtTokenContractAddress,
          usdcTokenContractAddress,
        ])
    )
      .to.emit(autheoCentralStore, "ContractRemovedFromWhitelist")
      .withArgs(usdcTokenContractAddress);

    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdcTokenContractAddress
      )
    ).to.be.equal(false);
    expect(
      await autheoCentralStore.whitelistedTierContracts(
        usdtTokenContractAddress
      )
    ).to.be.equal(false);
  });
  it("Upgradeability testing", async function () {
    const {
      owner,
      autheoCentralStore,
      test,
      account,
      proxyContractAddress,
      implemetationAddress,
    } = await loadFixture(contractDeployment);

    expect(await autheoCentralStore.referredCommissionPercentage()).to.be.equal(
      10
    );
    expect(await autheoCentralStore.referrerCommissionPercentage()).to.be.equal(
      10
    );

    expect(await autheoCentralStore.getContractVersion()).to.be.equal("0.0.1");

    const AutheoCentralStoreV2 = await ethers.getContractFactory(
      "AutheoCentralStoreV2"
    );
    const autheoCentralStoreV2 = await upgrades.upgradeProxy(
      proxyContractAddress,
      AutheoCentralStoreV2
    );

    const autheoCentralStoreV2ContractAddress =
      await autheoCentralStoreV2.getAddress();

    expect(proxyContractAddress).to.be.equal(
      autheoCentralStoreV2ContractAddress
    );

    const implemetationAddressV2 =
      await upgrades.erc1967.getImplementationAddress(proxyContractAddress);

    console.log("1:", implemetationAddress);
    console.log("2:", implemetationAddressV2);

    expect(await autheoCentralStoreV2.test()).to.be.equal(0);
    await autheoCentralStoreV2.updateTest(20);
    expect(await autheoCentralStoreV2.test()).to.be.equal(20);

    expect(await autheoCentralStoreV2.getContractVersion()).to.be.equal(
      "0.0.2"
    );
  });
});
