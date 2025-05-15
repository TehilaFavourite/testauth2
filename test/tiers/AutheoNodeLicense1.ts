const { expect } = require("chai");
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("Autheo Node License Tier 1", function () {
  async function contractDeployment() {
    const [owner, paymentReceiver, user1, user2, user3] =
      await ethers.getSigners();

    // mock oracle deployment
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const mockOracle = await MockOracle.deploy();
    const mockOracleContractAddress = await mockOracle.getAddress();

    // payment token deployment
    const USDTToken = await ethers.getContractFactory("USDTToken");
    const usdtToken = await USDTToken.deploy();
    const usdtTokenContractAddress = await usdtToken.getAddress();

    const USDCToken = await ethers.getContractFactory("USDCToken");
    const usdcToken = await USDCToken.deploy();
    const usdcTokenContractAddress = await usdcToken.getAddress();

    // autheo central store deployment
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

    const autheoCentralSmartContractAddress =
      await autheoCentralStore.getAddress();

    // autheo node contract deployment
    const AutheoNodeLicense1 = await ethers.getContractFactory(
      "AutheoNodeLicense1"
    );

    const autheoNodeLicense1 = await AutheoNodeLicense1.deploy(
      10000,
      "https://axshivam.github.io/",
      "1",
      paymentReceiver.address,
      autheoCentralSmartContractAddress,
      100
    );

    const autheoNodeLicense1ContractAddress =
      await autheoNodeLicense1.getAddress();

    await autheoCentralStore.whitelistContract([
      autheoNodeLicense1ContractAddress,
    ]);

    return {
      owner,
      user1,
      user2,
      user3,
      paymentReceiver,
      autheoNodeLicense1,
      usdcToken,
      usdtToken,
      autheoCentralStore,
      autheoCentralSmartContractAddress,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      autheoNodeLicense1ContractAddress,
    };
  }
  it("Initial State", async function () {
    const {
      owner,
      paymentReceiver,
      autheoNodeLicense1,
      autheoCentralSmartContractAddress,
    } = await loadFixture(contractDeployment);

    expect(await autheoNodeLicense1.autheoCentralStore()).to.be.equal(
      autheoCentralSmartContractAddress
    );
    expect(await autheoNodeLicense1.admin()).to.be.equal(owner.address);
    expect(await autheoNodeLicense1.paymentReceiver()).to.be.equal(
      paymentReceiver.address
    );
    expect(await autheoNodeLicense1._nextTokenId()).to.be.equal(0);
    expect(await autheoNodeLicense1.totalNodes()).to.be.equal(10000);
    expect(await autheoNodeLicense1.tier()).to.be.equal("1");
    expect(await autheoNodeLicense1.nodePriceInUSD()).to.be.equal(100);
    expect(await autheoNodeLicense1.tokenMintTimestamp(1)).to.be.equal(0);
    expect(await autheoNodeLicense1.LOCK_PERIOD()).to.be.equal(31536000);
    expect(await autheoNodeLicense1.name()).to.be.equal("Autheo Node License");
    expect(await autheoNodeLicense1.symbol()).to.be.equal("ANL");
  });
  it("transferAdminRole", async function () {
    const { owner, paymentReceiver, autheoNodeLicense1 } = await loadFixture(
      contractDeployment
    );

    expect(await autheoNodeLicense1.admin()).to.be.equal(owner.address);

    await expect(
      autheoNodeLicense1
        .connect(paymentReceiver)
        .transferAdminRole(paymentReceiver.address)
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await expect(
      autheoNodeLicense1.transferAdminRole(
        "0x0000000000000000000000000000000000000000"
      )
    ).to.be.revertedWith("Not a valid address");

    await expect(autheoNodeLicense1.transferAdminRole(paymentReceiver.address))
      .to.emit(autheoNodeLicense1, "AdminUpdated")
      .withArgs(paymentReceiver.address, owner.address);

    expect(await autheoNodeLicense1.admin()).to.be.equal(
      paymentReceiver.address
    );
  });
  it("updatePaymentReceiver", async function () {
    const { owner, paymentReceiver, autheoNodeLicense1 } = await loadFixture(
      contractDeployment
    );

    expect(await autheoNodeLicense1.paymentReceiver()).to.be.equal(
      paymentReceiver.address
    );

    await expect(
      autheoNodeLicense1.updatePaymentReceiver(
        "0x0000000000000000000000000000000000000000"
      )
    ).to.be.revertedWith("Not a valid address");

    await expect(
      autheoNodeLicense1
        .connect(paymentReceiver)
        .updatePaymentReceiver(owner.address)
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await expect(autheoNodeLicense1.updatePaymentReceiver(owner.address))
      .to.emit(autheoNodeLicense1, "PaymentReceiverUpdated")
      .withArgs(owner.address, paymentReceiver.address);
  });
  it("mintWithUSDCOrUSDT", async function () {
    const {
      owner,
      user1,
      user2,
      user3,
      paymentReceiver,
      autheoNodeLicense1,
      usdcToken,
      usdtToken,
      autheoCentralStore,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      autheoNodeLicense1ContractAddress,
    } = await loadFixture(contractDeployment);

    await expect(
      autheoNodeLicense1
        .connect(user1)
        .mintWithUSDCOrUSDT(owner.address, 1000, "")
    ).to.be.revertedWith("Unsupported token");

    await expect(
      autheoNodeLicense1
        .connect(user1)
        .mintWithUSDCOrUSDT(usdtTokenContractAddress, 0, "")
    ).to.be.revertedWith("Quantity is 0");

    await expect(
      autheoNodeLicense1
        .connect(user1)
        .mintWithUSDCOrUSDT(usdtTokenContractAddress, 1000, "")
    ).to.be.revertedWith("Limit exceeded");

    await expect(
      autheoNodeLicense1
        .connect(user1)
        .mintWithUSDCOrUSDT(usdtTokenContractAddress, 49, "")
    ).to.be.revertedWith("User kyc is not valid");

    await autheoCentralStore.updateKYCStatus(user1.address, true);

    await expect(
      autheoNodeLicense1
        .connect(user1)
        .mintWithUSDCOrUSDT(usdtTokenContractAddress, 49, "")
    ).to.be.revertedWith("Insufficient token allowance");

    expect(await usdtToken.balanceOf(user1.address)).to.be.equal(0);
    await usdtToken.transfer(user1.address, 5000000000);
    expect(await usdtToken.balanceOf(user1.address)).to.be.equal(5000000000);

    await usdtToken
      .connect(user1)
      .approve(autheoNodeLicense1ContractAddress, 5000000000);

    expect(
      await usdtToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(0);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdtTokenContractAddress)
    ).to.be.equal(0);
    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(0);
    expect(await autheoCentralStore.userHoldings(user1.address)).to.be.equal(0);
    expect(await autheoNodeLicense1.tokenMintTimestamp(49)).to.be.equal(0);

    await autheoNodeLicense1
      .connect(user1)
      .mintWithUSDCOrUSDT(usdtTokenContractAddress, 49, "");

    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(49);
    for (let i = 1; i < 50; i++) {
      expect(await autheoNodeLicense1.ownerOf(i)).to.be.equal(user1.address);
    }
    expect(
      await usdtToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(4900000000);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdtTokenContractAddress)
    ).to.be.equal(4900000000);
    expect(await usdtToken.balanceOf(user1.address)).to.be.equal(100000000);
    expect(await autheoCentralStore.userHoldings(user1.address)).to.be.equal(
      49
    );

    await expect(
      autheoNodeLicense1
        .connect(user1)
        .mintWithUSDCOrUSDT(usdtTokenContractAddress, 51, "axshivam")
    ).to.be.revertedWith("Referral Code is not active");

    await autheoCentralStore.updateKYCStatus(user2.address, true);

    // @ts-ignore
    await autheoCentralStore.connect(user2).generateReferralCode("axshivam");

    await usdtToken.transfer(user1.address, 5000000000);
    await usdtToken
      .connect(user1)
      .approve(autheoNodeLicense1ContractAddress, 5000000000);

    expect(await usdtToken.balanceOf(user2.address)).to.be.equal(0);

    await autheoNodeLicense1
      .connect(user1)
      .mintWithUSDCOrUSDT(usdtTokenContractAddress, 51, "axshivam");

    expect(await usdtToken.balanceOf(user1.address)).to.be.equal(510000000);
    expect(await usdtToken.balanceOf(user2.address)).to.be.equal(459000000);
    expect(
      await usdtToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(9031000000);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdtTokenContractAddress)
    ).to.be.equal(9031000000);

    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(100);
    for (let i = 1; i <= 100; i++) {
      expect(await autheoNodeLicense1.ownerOf(i)).to.be.equal(user1.address);
    }

    expect(await usdtToken.balanceOf(paymentReceiver.address)).to.be.equal(0);
    await autheoNodeLicense1.withdrawTokens(usdtTokenContractAddress);
    expect(
      await usdtToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(0);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdtTokenContractAddress)
    ).to.be.equal(0);
    expect(await usdtToken.balanceOf(paymentReceiver.address)).to.be.equal(
      9031000000
    );

    await expect(
      autheoNodeLicense1
        .connect(user1)
        .mintWithUSDCOrUSDT(usdtTokenContractAddress, 1, "axshivam")
    ).to.be.revertedWith("Limit exceeded");

    // now user3 with usdc
    await autheoCentralStore.updateReferredCommissionPercentage(7);

    await autheoCentralStore.updateReferrerCommisionPercentage(6);

    await usdcToken
      .connect(user3)
      .approve(autheoNodeLicense1ContractAddress, 10000000000);

    await usdcToken.transfer(user3.address, 100000000);

    expect(await autheoNodeLicense1.balanceOf(user3.address)).to.be.equal(0);

    await autheoCentralStore.updateKYCStatus(user3.address, true);

    await autheoNodeLicense1
      .connect(user3)
      .mintWithUSDCOrUSDT(usdcTokenContractAddress, 1, "");

    expect(
      await usdcToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(100000000);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdcTokenContractAddress)
    ).to.be.equal(100000000);
    expect(await usdcToken.balanceOf(user3.address)).to.be.equal(0);
    expect(await autheoCentralStore.userHoldings(user3.address)).to.be.equal(1);
    expect(await autheoNodeLicense1.ownerOf(101)).to.be.equal(user3.address);

    // @ts-ignore
    await autheoCentralStore.connect(user1).generateReferralCode("axshivam1");

    await usdcToken.transfer(user3.address, 9900000000);
    await autheoNodeLicense1
      .connect(user3)
      .mintWithUSDCOrUSDT(usdcTokenContractAddress, 99, "axshivam1");

    expect(await usdcToken.balanceOf(user3.address)).to.be.equal(693000000);
    expect(await usdcToken.balanceOf(user1.address)).to.be.equal(552420000);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdcTokenContractAddress)
    ).to.be.equal(9900000000 + 100000000 - 693000000 - 552420000);

    for (let i = 101; i <= 200; i++) {
      expect(await autheoNodeLicense1.ownerOf(i)).to.be.equal(user3.address);
    }
  });
  it("mintWithUSDCOrUSDT", async function () {
    const {
      owner,
      user1,
      user2,
      user3,
      paymentReceiver,
      autheoNodeLicense1,
      usdcToken,
      usdtToken,
      autheoCentralStore,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      autheoNodeLicense1ContractAddress,
    } = await loadFixture(contractDeployment);

    await expect(
      autheoNodeLicense1
        .connect(user1)
        .mintWithUSDCOrUSDT(usdtTokenContractAddress, 10, "axshivam")
    ).to.be.revertedWith("User kyc is not valid");

    await autheoCentralStore.updateKYCStatus(user1.address, true);

    await expect(
      autheoNodeLicense1
        .connect(user1)
        .mintWithUSDCOrUSDT(usdtTokenContractAddress, 10, "axshivam")
    ).to.be.revertedWith("Referral Code is not active");

    await autheoCentralStore.updateBlackListUser(user2.address, true);

    await expect(
      autheoNodeLicense1
        .connect(user2)
        .mintWithUSDCOrUSDT(usdtTokenContractAddress, 10, "axshivam")
    ).to.be.revertedWith("Blacklisted User");

    await autheoCentralStore.updateReferredCommissionPercentage(2);

    await autheoCentralStore.updateReferrerCommisionPercentage(3);

    await autheoCentralStore.updateKYCStatus(user3.address, true);

    // @ts-ignore
    await autheoCentralStore.connect(user3).generateReferralCode("axshivam");

    await usdtToken.transfer(user1.address, 1900000000);
    await usdtToken
      .connect(user1)
      .approve(autheoNodeLicense1ContractAddress, 1900000000);
    expect(
      await usdtToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(0);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdtTokenContractAddress)
    ).to.be.equal(0);
    expect(await usdtToken.balanceOf(user1.address)).to.be.equal(1900000000);
    expect(await usdtToken.balanceOf(user3.address)).to.be.equal(0);
    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(0);
    expect(await autheoCentralStore.userHoldings(user1.address)).to.be.equal(0);
    expect(await autheoNodeLicense1._nextTokenId()).to.be.equal(0);

    await autheoNodeLicense1
      .connect(user1)
      .mintWithUSDCOrUSDT(usdtTokenContractAddress, 19, "axshivam");

    expect(await usdtToken.balanceOf(user3.address)).to.be.equal(55860000);
    expect(await usdtToken.balanceOf(user1.address)).to.be.equal(38000000);
    expect(
      await usdtToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(1900000000 - 55860000 - 38000000);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdtTokenContractAddress)
    ).to.be.equal(1806140000);
    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(19);
    expect(await autheoCentralStore.userHoldings(user1.address)).to.be.equal(
      19
    );
    expect(await autheoNodeLicense1._nextTokenId()).to.be.equal(19);

    await usdtToken.transfer(user1.address, 1000000000);
    await usdtToken
      .connect(user1)
      .approve(autheoNodeLicense1ContractAddress, 1000000000);

    await autheoNodeLicense1
      .connect(user1)
      .mintWithUSDCOrUSDT(usdtTokenContractAddress, 10, "");

    expect(await usdtToken.balanceOf(user3.address)).to.be.equal(55860000);
    expect(await usdtToken.balanceOf(user1.address)).to.be.equal(38000000);
    expect(
      await usdtToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(1806140000 + 1000000000);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdtTokenContractAddress)
    ).to.be.equal(1806140000 + 1000000000);
    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(29);
    expect(await autheoCentralStore.userHoldings(user1.address)).to.be.equal(
      29
    );
    expect(await autheoNodeLicense1._nextTokenId()).to.be.equal(29);

    await autheoCentralStore.updateBlackListUser(user2.address, false);

    await autheoCentralStore.updateReferredCommissionPercentage(11);

    await autheoCentralStore.updateReferrerCommisionPercentage(19);

    await autheoCentralStore.updateKYCStatus(user2.address, true);
    // @ts-ignore
    await autheoCentralStore.connect(user2).generateReferralCode("user123");

    await usdtToken.transfer(user1.address, 7100000000);
    await usdtToken
      .connect(user1)
      .approve(autheoNodeLicense1ContractAddress, 7100000000);

    await autheoNodeLicense1
      .connect(user1)
      .mintWithUSDCOrUSDT(usdtTokenContractAddress, 71, "user123");

    expect(await usdtToken.balanceOf(user3.address)).to.be.equal(55860000);
    expect(await usdtToken.balanceOf(user2.address)).to.be.equal(1200610000);
    expect(await usdtToken.balanceOf(user1.address)).to.be.equal(
      38000000 + 781000000
    );
    expect(
      await usdtToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(1806140000 + 1000000000 + 5118390000);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdtTokenContractAddress)
    ).to.be.equal(1806140000 + 1000000000 + 5118390000);
    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(
      29 + 71
    );
    expect(await autheoCentralStore.userHoldings(user1.address)).to.be.equal(
      29 + 71
    );
    expect(await autheoNodeLicense1._nextTokenId()).to.be.equal(29 + 71);
  });
  it("mint", async function () {
    const {
      owner,
      user1,
      user2,
      user3,
      paymentReceiver,
      autheoNodeLicense1,
      usdcToken,
      usdtToken,
      autheoCentralStore,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      autheoNodeLicense1ContractAddress,
    } = await loadFixture(contractDeployment);

    await autheoCentralStore.updateKYCStatus(user1.address, true);
    await autheoCentralStore.updateKYCStatus(user2.address, true);
    await autheoCentralStore.updateKYCStatus(user3.address, true);
    await autheoCentralStore.updateKYCStatus(owner.address, true);

    await expect(
      autheoNodeLicense1.connect(user1).mint(0, "")
    ).to.be.revertedWith("Quantity is 0");

    await expect(
      autheoNodeLicense1.connect(user1).mint(1, "")
    ).to.be.revertedWith("Insufficient ETH");

    await expect(
      autheoNodeLicense1.connect(user1).mint(101, "")
    ).to.be.revertedWith("Limit exceeded");

    await autheoCentralStore.updateBlackListUser(user1.address, true);

    await expect(
      autheoNodeLicense1.connect(user1).mint(100, "")
    ).to.be.revertedWith("Blacklisted User");

    await autheoCentralStore.updateBlackListUser(user1.address, false);

    const oraclePriceInOneUSD = await autheoCentralStore.getUsdPriceInEth();

    const paymentForOneNode = 100 * Number(oraclePriceInOneUSD);

    expect(await autheoNodeLicense1.balanceOfContract()).to.be.equal(0);
    expect(
      await ethers.provider.getBalance(autheoNodeLicense1ContractAddress)
    ).to.be.equal(0);
    // expect(await ethers.provider.getBalance(user1.address)).to.be.equal(9999999770493395191759n);
    await autheoNodeLicense1
      .connect(user1)
      .mint(1, "", { value: BigInt(paymentForOneNode) });
    expect(await autheoNodeLicense1.balanceOfContract()).to.be.equal(
      26606859413319200n
    );
    expect(
      await ethers.provider.getBalance(autheoNodeLicense1ContractAddress)
    ).to.be.equal(26606859413319200n);
    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(1);
    expect(await autheoNodeLicense1.ownerOf(1)).to.be.equal(user1.address);

    // @ts-ignore
    await autheoCentralStore.connect(user2).generateReferralCode("axshivam");

    const user2Balance = await ethers.provider.getBalance(user2.address);

    expect(await ethers.provider.getBalance(user2.address)).to.be.equal(
      user2Balance
    );

    // expect(await ethers.provider.getBalance(user1.address)).to.be.equal(9999972964105868341325n);
    await autheoNodeLicense1
      .connect(user1)
      .mint(59, "axshivam", { value: BigInt(paymentForOneNode) * BigInt(64) });
    // expect(await ethers.provider.getBalance(user1.address)).to.be.equal(9999972964105868341325n);

    expect(await ethers.provider.getBalance(user2.address)).to.be.equal(
      user2Balance + 141282423484724952n
    );
    expect(await autheoNodeLicense1.balanceOfContract()).to.be.equal(
      26606859413319200n + 1271541811362524568n
    );
    expect(
      await ethers.provider.getBalance(autheoNodeLicense1ContractAddress)
    ).to.be.equal(26606859413319200n + 1271541811362524568n);
    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(60);

    for (let i = 1; i <= 60; i++) {
      expect(await autheoNodeLicense1.ownerOf(i)).to.be.equal(user1.address);
    }
  });
  it("refund extra amount", async function () {
    const {
      owner,
      user1,
      user2,
      user3,
      paymentReceiver,
      autheoNodeLicense1,
      usdcToken,
      usdtToken,
      autheoCentralStore,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      autheoNodeLicense1ContractAddress,
    } = await loadFixture(contractDeployment);

    await autheoCentralStore.updateKYCStatus(user1.address, true);
    await autheoCentralStore.updateKYCStatus(user2.address, true);
    await autheoCentralStore.updateKYCStatus(user3.address, true);
    await autheoCentralStore.updateKYCStatus(owner.address, true);

    // case 1: without referral case: user1
    const payment = ethers.parseUnits("9999000000000000000000", "wei");
    // console.log(
    //   "User1 Balance B:",
    //   await ethers.provider.getBalance(user1.address)
    // );
    expect(await autheoNodeLicense1.balanceOfContract()).to.be.equal(0);

    const paymentReceiverBalance = await ethers.provider.getBalance(
      paymentReceiver.address
    );
    expect(
      await ethers.provider.getBalance(paymentReceiver.address)
    ).to.be.equal(paymentReceiverBalance);
    await autheoNodeLicense1.connect(user1).mint(100, "", { value: payment });
    expect(await autheoNodeLicense1.balanceOfContract()).to.be.equal(
      2660685941331920000n
    );

    await autheoNodeLicense1.withdraw();
    expect(
      await ethers.provider.getBalance(paymentReceiver.address)
    ).to.be.equal(paymentReceiverBalance + 2660685941331920000n);
    expect(await autheoNodeLicense1.balanceOfContract()).to.be.equal(0);
    // console.log(
    //   "User1 Balance A:",
    //   await ethers.provider.getBalance(user1.address)
    // );

    // case2: with referral code: user2 and user3
    // expect(await ethers.provider.getBalance(user2.address)).to.be.equal(
    //   10000000000000000000000n
    // );
    // expect(await ethers.provider.getBalance(user3.address)).to.be.equal(
    //   10000000000000000000000n
    // );

    // @ts-ignore
    await autheoCentralStore.connect(user2).generateReferralCode("axshivam");

    // console.log(
    //   "User3 Balance B:",
    //   await ethers.provider.getBalance(user3.address)
    // );
    await autheoNodeLicense1
      .connect(user3)
      .mint(57, "axshivam", { value: payment });

    // console.log(
    //   "User3 Balance A:",
    //   await ethers.provider.getBalance(user3.address)
    // );

    expect(await autheoNodeLicense1.balanceOfContract()).to.be.equal(
      1228438699112947464n
    );
  });
  it("Transfer Functionality", async function () {
    const {
      owner,
      user1,
      user2,
      user3,
      paymentReceiver,
      autheoNodeLicense1,
      usdcToken,
      usdtToken,
      autheoCentralStore,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      autheoNodeLicense1ContractAddress,
    } = await loadFixture(contractDeployment);

    await autheoCentralStore.updateKYCStatus(user1.address, true);
    await autheoCentralStore.updateKYCStatus(user2.address, true);
    await autheoCentralStore.updateKYCStatus(user3.address, true);
    await autheoCentralStore.updateKYCStatus(owner.address, true);

    const payment = ethers.parseUnits("9999000000000000000000", "wei");

    await autheoNodeLicense1.connect(user1).mint(100, "", { value: payment });

    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(100);
    expect(await autheoNodeLicense1.ownerOf(1)).to.be.equal(user1.address);
    expect(await autheoNodeLicense1.ownerOf(100)).to.be.equal(user1.address);

    await expect(
      autheoNodeLicense1
        .connect(user1)
        ["safeTransferFrom(address,address,uint256)"](
          user1.address,
          user2.address,
          1
        )
    ).to.be.revertedWith("NFT locked for 12 months");

    await expect(
      autheoNodeLicense1
        .connect(user1)
        ["safeTransferFrom(address,address,uint256,bytes)"](
          user1.address,
          user2.address,
          1,
          "0x"
        )
    ).to.be.revertedWith("NFT locked for 12 months");

    await time.increase(31535995);

    await expect(
      autheoNodeLicense1
        .connect(user1)
        ["safeTransferFrom(address,address,uint256,bytes)"](
          user1.address,
          user2.address,
          1,
          "0x"
        )
    ).to.be.revertedWith("NFT locked for 12 months");

    await time.increase(1);

    await autheoNodeLicense1
      .connect(user1)
      ["safeTransferFrom(address,address,uint256,bytes)"](
        user1.address,
        user2.address,
        1,
        "0x"
      );

    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(99);
    expect(await autheoNodeLicense1.ownerOf(1)).to.be.equal(user2.address);
    expect(await autheoNodeLicense1.balanceOf(user2.address)).to.be.equal(1);

    await autheoNodeLicense1
      .connect(user1)
      ["safeTransferFrom(address,address,uint256,bytes)"](
        user1.address,
        user2.address,
        2,
        "0x"
      );
    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(98);
    expect(await autheoNodeLicense1.balanceOf(user2.address)).to.be.equal(2);
    expect(await autheoNodeLicense1.ownerOf(2)).to.be.equal(user2.address);

    await autheoNodeLicense1
      .connect(user2)
      ["safeTransferFrom(address,address,uint256)"](
        user2.address,
        user1.address,
        2
      );
    expect(await autheoNodeLicense1.ownerOf(2)).to.be.equal(user1.address);
    expect(await autheoNodeLicense1.balanceOf(user2.address)).to.be.equal(1);

    await autheoNodeLicense1
      .connect(user2)
      ["safeTransferFrom(address,address,uint256)"](
        user2.address,
        user1.address,
        1
      );

    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(100);

    const newPayment = ethers.parseUnits("9999000000000000000000", "wei");

    await autheoNodeLicense1
      .connect(user2)
      .mint(100, "", { value: newPayment });

    expect(await autheoNodeLicense1.balanceOf(user2.address)).to.be.equal(100);
    expect(await autheoNodeLicense1.ownerOf(101)).to.be.equal(user2.address);
    expect(await autheoNodeLicense1.ownerOf(200)).to.be.equal(user2.address);

    await expect(
      autheoNodeLicense1
        .connect(user2)
        .transferFrom(user2.address, user1.address, 101)
    ).to.be.revertedWith("NFT locked for 12 months");

    const currentTime = await time.latest();
    const tokenMintTimestampFor3 = await autheoNodeLicense1.tokenMintTimestamp(
      101
    );

    expect(currentTime - Number(tokenMintTimestampFor3)).to.be.equal(1);

    await time.increase(31535998);

    await autheoNodeLicense1
      .connect(user2)
      .transferFrom(user2.address, user1.address, 101);
    await autheoNodeLicense1
      .connect(user2)
      ["safeTransferFrom(address,address,uint256)"](
        user2.address,
        user1.address,
        102
      );

    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(102);
    expect(await autheoNodeLicense1.balanceOf(user2.address)).to.be.equal(98);
  });
  it("Return valid tier", async function () {
    const { owner, autheoNodeLicense1 } = await loadFixture(contractDeployment);

    expect(await autheoNodeLicense1.tier()).to.be.equal("1");
  });
  it("Constructor", async function () {
    const [owner, admin, paymentReceiver2] = await ethers.getSigners();

    const autheoNodeLicense1 = await ethers.getContractFactory(
      "AutheoNodeLicense1"
    );

    await expect(
      autheoNodeLicense1.deploy(
        10000,
        "https://axshivam.github.io/",
        "1",
        "0x0000000000000000000000000000000000000000",
        admin.address,
        100
      )
    ).to.be.revertedWith("Not a valid address");

    await expect(
      autheoNodeLicense1.deploy(
        10000,
        "https://axshivam.github.io/",
        "1",
        admin.address,
        "0x0000000000000000000000000000000000000000",
        100
      )
    ).to.be.revertedWith("Not a valid address");
  });
  it("Token uri management", async function () {
    const {
      owner,
      user1,
      user2,
      user3,
      paymentReceiver,
      autheoNodeLicense1,
      usdcToken,
      usdtToken,
      autheoCentralStore,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      autheoNodeLicense1ContractAddress,
    } = await loadFixture(contractDeployment);

    await autheoCentralStore.updateKYCStatus(user1.address, true);
    await autheoCentralStore.updateKYCStatus(user2.address, true);
    await autheoCentralStore.updateKYCStatus(user3.address, true);
    await autheoCentralStore.updateKYCStatus(owner.address, true);

    const payment = ethers.parseUnits("9999000000000000000000", "wei");

    await autheoNodeLicense1.connect(user1).mint(100, "", { value: payment });

    expect(await autheoNodeLicense1.tokenURI(1)).to.be.equal(
      "https://axshivam.github.io/1.json"
    );

    await expect(
      autheoNodeLicense1
        .connect(user1)
        .setBaseURI("https://axshivam.github.io/nfts/")
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");
    await autheoNodeLicense1.setBaseURI("https://axshivam.github.io/nfts/");

    expect(await autheoNodeLicense1.tokenURI(1)).to.be.equal(
      "https://axshivam.github.io/nfts/1.json"
    );
  });
  it("mint with exact amount", async function () {
    const {
      owner,
      user1,
      user2,
      user3,
      paymentReceiver,
      autheoNodeLicense1,
      usdcToken,
      usdtToken,
      autheoCentralStore,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      autheoNodeLicense1ContractAddress,
    } = await loadFixture(contractDeployment);

    await autheoCentralStore.updateKYCStatus(user1.address, true);
    await autheoCentralStore.updateKYCStatus(user2.address, true);
    await autheoCentralStore.updateKYCStatus(user3.address, true);
    await autheoCentralStore.updateKYCStatus(owner.address, true);

    const oraclePriceInOneUSD = await autheoCentralStore.getUsdPriceInEth();

    const paymentForOneNode = 100n * oraclePriceInOneUSD;

    const paymentFor57Nodes = 57n * paymentForOneNode;

    // console.log("One node price in wei:", paymentForOneNode);
    // console.log("57 node price in wei:", paymentFor57Nodes);

    const referredCommissionPercentage =
      await autheoCentralStore.referredCommissionPercentage();
    // console.log("1:", referredCommissionPercentage);
    const discount = (paymentFor57Nodes * referredCommissionPercentage) / 100n;

    const finalAmount = paymentFor57Nodes - discount;

    // @ts-ignore
    await autheoCentralStore.connect(user2).generateReferralCode("axshivam");

    await autheoNodeLicense1.mint(57, "axshivam", { value: finalAmount });
  });
  it("withdraw", async function () {
    const {
      owner,
      user1,
      user2,
      user3,
      paymentReceiver,
      autheoNodeLicense1,
      usdcToken,
      usdtToken,
      autheoCentralStore,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      autheoNodeLicense1ContractAddress,
    } = await loadFixture(contractDeployment);

    await autheoCentralStore.updateKYCStatus(user1.address, true);
    await autheoCentralStore.updateKYCStatus(user2.address, true);
    await autheoCentralStore.updateKYCStatus(user3.address, true);
    await autheoCentralStore.updateKYCStatus(owner.address, true);

    await expect(autheoNodeLicense1.withdraw()).to.be.revertedWith(
      "No ETH to withdraw"
    );

    const oraclePriceInOneUSD = await autheoCentralStore.getUsdPriceInEth();

    const paymentForOneNode = 100n * oraclePriceInOneUSD;

    const paymentFor57Nodes = 57n * paymentForOneNode;

    const referredCommissionPercentage =
      await autheoCentralStore.referredCommissionPercentage();
    const discount = (paymentFor57Nodes * referredCommissionPercentage) / 100n;
    const finalAmount = paymentFor57Nodes - discount;

    // @ts-ignore
    await autheoCentralStore.connect(user2).generateReferralCode("axshivam");

    expect(await autheoNodeLicense1.balanceOfContract()).to.be.equal(0);
    expect(
      await ethers.provider.getBalance(autheoNodeLicense1ContractAddress)
    ).to.be.equal(0);

    await autheoNodeLicense1.mint(57, "axshivam", { value: finalAmount });

    const referrerCommissionPercentage =
      await autheoCentralStore.referrerCommissionPercentage();
    const referrerCommission =
      (finalAmount * referrerCommissionPercentage) / 100n;

    expect(await autheoNodeLicense1.balanceOfContract()).to.be.equal(
      finalAmount - referrerCommission
    );
    expect(
      await ethers.provider.getBalance(autheoNodeLicense1ContractAddress)
    ).to.be.equal(finalAmount - referrerCommission);

    const paymentReceiverBalance = await ethers.provider.getBalance(
      paymentReceiver.address
    );

    // console.log("paymentReceiverBalance:", paymentReceiverBalance);

    await expect(
      autheoNodeLicense1.connect(user2).withdraw()
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await autheoNodeLicense1.withdraw();

    expect(await autheoNodeLicense1.balanceOfContract()).to.be.equal(0);
    expect(
      await ethers.provider.getBalance(autheoNodeLicense1ContractAddress)
    ).to.be.equal(0);

    console.log("Final:", finalAmount - referrerCommission);

    expect(
      await ethers.provider.getBalance(paymentReceiver.address)
    ).to.be.equal(paymentReceiverBalance + (finalAmount - referrerCommission));

    // console.log("paymentReceiverBalance1:", paymentReceiverBalance1);

    await autheoNodeLicense1
      .connect(user2)
      .mint(57, "axshivam", { value: finalAmount });

    expect(await autheoNodeLicense1.balanceOfContract()).to.be.equal(
      finalAmount - referrerCommission
    );
    expect(
      await ethers.provider.getBalance(autheoNodeLicense1ContractAddress)
    ).to.be.equal(finalAmount - referrerCommission);

    await autheoNodeLicense1.withdraw();

    expect(
      await ethers.provider.getBalance(paymentReceiver.address)
    ).to.be.equal(
      paymentReceiverBalance + (finalAmount - referrerCommission) * 2n
    );

    expect(await autheoNodeLicense1.balanceOfContract()).to.be.equal(0);
    await expect(
      autheoNodeLicense1.tokenBalanceOfContract(user2.address)
    ).to.be.revertedWith("Unsupported token");
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdcTokenContractAddress)
    ).to.be.equal(0);

    await autheoNodeLicense1
      .connect(user3)
      .mint(99, "", { value: BigInt(9900000000000000000000n) });

    await expect(autheoNodeLicense1.withdraw())
      .to.emit(autheoNodeLicense1, "ETHWithdrawn")
      .withArgs(paymentReceiver.address, paymentForOneNode * 99n);
  });
  it("withdrawTokens", async function () {
    const {
      owner,
      user1,
      user2,
      user3,
      paymentReceiver,
      autheoNodeLicense1,
      usdcToken,
      usdtToken,
      autheoCentralStore,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      autheoNodeLicense1ContractAddress,
    } = await loadFixture(contractDeployment);

    await autheoCentralStore.updateKYCStatus(user1.address, true);
    await autheoCentralStore.updateKYCStatus(user2.address, true);
    await autheoCentralStore.updateKYCStatus(user3.address, true);
    await autheoCentralStore.updateKYCStatus(owner.address, true);

    // @ts-ignore
    await autheoCentralStore.connect(user3).generateReferralCode("axshivam");

    await usdtToken.transfer(user1.address, 1900000000);
    await usdtToken
      .connect(user1)
      .approve(autheoNodeLicense1ContractAddress, 1900000000);
    expect(
      await usdtToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(0);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdtTokenContractAddress)
    ).to.be.equal(0);

    await autheoNodeLicense1
      .connect(user1)
      .mintWithUSDCOrUSDT(usdtTokenContractAddress, 19, "axshivam");

    expect(
      await usdtToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(1539000000);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdtTokenContractAddress)
    ).to.be.equal(1539000000);

    expect(await usdtToken.balanceOf(paymentReceiver.address)).to.be.equal(0);

    await expect(
      autheoNodeLicense1
        .connect(paymentReceiver)
        .withdrawTokens(usdtTokenContractAddress)
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await expect(
      autheoNodeLicense1.withdrawTokens(paymentReceiver.address)
    ).to.be.revertedWith("Unsupported token");

    await autheoNodeLicense1.withdrawTokens(usdtTokenContractAddress);

    expect(
      await usdtToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(0);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdtTokenContractAddress)
    ).to.be.equal(0);

    expect(await usdtToken.balanceOf(paymentReceiver.address)).to.be.equal(
      1539000000
    );

    await expect(
      autheoNodeLicense1.withdrawTokens(usdtTokenContractAddress)
    ).to.be.revertedWith("No tokens to withdraw");

    await expect(
      autheoNodeLicense1.withdrawTokens(usdcTokenContractAddress)
    ).to.be.revertedWith("No tokens to withdraw");

    await usdcToken.transfer(user1.address, 1900000000);
    await usdcToken
      .connect(user1)
      .approve(autheoNodeLicense1ContractAddress, 1900000000);
    expect(
      await usdcToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(0);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdcTokenContractAddress)
    ).to.be.equal(0);

    await autheoNodeLicense1
      .connect(user1)
      .mintWithUSDCOrUSDT(usdcTokenContractAddress, 19, "axshivam");

    expect(
      await usdcToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(1539000000);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdcTokenContractAddress)
    ).to.be.equal(1539000000);

    expect(await usdcToken.balanceOf(paymentReceiver.address)).to.be.equal(0);

    await expect(autheoNodeLicense1.withdrawTokens(usdcToken))
      .to.emit(autheoNodeLicense1, "TokensWithdrawn")
      .withArgs(paymentReceiver.address, usdcTokenContractAddress, 1539000000);

    expect(
      await usdcToken.balanceOf(autheoNodeLicense1ContractAddress)
    ).to.be.equal(0);
    expect(
      await autheoNodeLicense1.tokenBalanceOfContract(usdcTokenContractAddress)
    ).to.be.equal(0);

    expect(await usdcToken.balanceOf(paymentReceiver.address)).to.be.equal(
      1539000000
    );

    await expect(
      autheoNodeLicense1.withdrawTokens(usdcTokenContractAddress)
    ).to.be.revertedWith("No tokens to withdraw");
  });
  it("mintWithUSDCOrUSDT for internal account", async function () {
    const {
      owner,
      user1,
      user2,
      user3,
      paymentReceiver,
      autheoNodeLicense1,
      usdcToken,
      usdtToken,
      autheoCentralStore,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      autheoNodeLicense1ContractAddress,
    } = await loadFixture(contractDeployment);

    await autheoCentralStore.updateKYCStatus(user3.address, true);
    await autheoCentralStore.updateKYCStatus(user1.address, true);

    // @ts-ignore
    await autheoCentralStore.connect(user3).generateReferralCode("axshivam");

    await usdtToken.transfer(user1.address, 1900000000);
    await usdtToken
      .connect(user1)
      .approve(autheoNodeLicense1ContractAddress, 1900000000);

    await autheoCentralStore.addInternalAccounts([user1.address]);

    await expect(
      autheoNodeLicense1
        .connect(user1)
        .mintWithUSDCOrUSDT(usdtTokenContractAddress, 19, "axshivam")
    ).to.be.revertedWith("Limit exceeded");

    await autheoNodeLicense1
      .connect(user1)
      .mintWithUSDCOrUSDT(usdtTokenContractAddress, 5, "axshivam");
  });
  it("mint for internal accounts", async function () {
    const {
      owner,
      user1,
      user2,
      user3,
      paymentReceiver,
      autheoNodeLicense1,
      usdcToken,
      usdtToken,
      autheoCentralStore,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      autheoNodeLicense1ContractAddress,
    } = await loadFixture(contractDeployment);

    await autheoCentralStore.updateKYCStatus(user1.address, true);
    await autheoCentralStore.updateKYCStatus(user2.address, true);
    await autheoCentralStore.updateKYCStatus(user3.address, true);
    await autheoCentralStore.updateKYCStatus(owner.address, true);

    const oraclePriceInOneUSD = await autheoCentralStore.getUsdPriceInEth();

    const paymentForOneNode = 100 * Number(oraclePriceInOneUSD);

    await autheoNodeLicense1
      .connect(user1)
      .mint(100, "", { value: 100n * BigInt(paymentForOneNode) });

    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(100);

    await autheoCentralStore.addInternalAccounts([
      user2.address,
      user3.address,
    ]);

    await expect(
      autheoNodeLicense1
        .connect(user2)
        .mint(6, "", { value: 100n * BigInt(paymentForOneNode) })
    ).to.be.revertedWith("Limit exceeded");

    expect(await autheoNodeLicense1.balanceOf(user2.address)).to.be.equal(0);
    await autheoNodeLicense1
      .connect(user2)
      .mint(5, "", { value: 100n * BigInt(paymentForOneNode) });
    expect(await autheoNodeLicense1.balanceOf(user2.address)).to.be.equal(5);

    await expect(
      autheoNodeLicense1
        .connect(user2)
        .mint(1, "", { value: 100n * BigInt(paymentForOneNode) })
    ).to.be.revertedWith("Limit exceeded");

    expect(await autheoNodeLicense1.balanceOf(user3.address)).to.be.equal(0);
    await autheoNodeLicense1
      .connect(user3)
      .mint(1, "", { value: 100n * BigInt(paymentForOneNode) });
    expect(await autheoNodeLicense1.balanceOf(user3.address)).to.be.equal(1);
    await autheoNodeLicense1
      .connect(user3)
      .mint(2, "", { value: 100n * BigInt(paymentForOneNode) });
    expect(await autheoNodeLicense1.balanceOf(user3.address)).to.be.equal(3);
    await autheoNodeLicense1
      .connect(user3)
      .mint(2, "", { value: 100n * BigInt(paymentForOneNode) });
    expect(await autheoNodeLicense1.balanceOf(user3.address)).to.be.equal(5);

    await expect(
      autheoNodeLicense1
        .connect(user3)
        .mint(1, "", { value: 100n * BigInt(paymentForOneNode) })
    ).to.be.revertedWith("Limit exceeded");

    expect(await autheoNodeLicense1.balanceOf(owner.address)).to.be.equal(0);
    await autheoNodeLicense1
      .connect(owner)
      .mint(1, "", { value: 100n * BigInt(paymentForOneNode) });
    expect(await autheoNodeLicense1.balanceOf(owner.address)).to.be.equal(1);
    await autheoNodeLicense1
      .connect(owner)
      .mint(2, "", { value: 100n * BigInt(paymentForOneNode) });
    expect(await autheoNodeLicense1.balanceOf(owner.address)).to.be.equal(3);
    await autheoNodeLicense1
      .connect(owner)
      .mint(2, "", { value: 100n * BigInt(paymentForOneNode) });
    expect(await autheoNodeLicense1.balanceOf(owner.address)).to.be.equal(5);

    await autheoCentralStore.addInternalAccounts([owner.address]);
    await expect(
      autheoNodeLicense1
        .connect(owner)
        .mint(1, "", { value: 100n * BigInt(paymentForOneNode) })
    ).to.be.revertedWith("Limit exceeded");

    await autheoCentralStore.updateInternalWalletMaxHoldings(10);

    await expect(
      autheoNodeLicense1
        .connect(owner)
        .mint(6, "", { value: 100n * BigInt(paymentForOneNode) })
    ).to.be.revertedWith("Limit exceeded");
  });
  it("nodeHostedStatus", async function () {
    const {
      owner,
      user1,
      user2,
      user3,
      paymentReceiver,
      autheoNodeLicense1,
      usdcToken,
      usdtToken,
      autheoCentralStore,
      usdcTokenContractAddress,
      usdtTokenContractAddress,
      autheoNodeLicense1ContractAddress,
    } = await loadFixture(contractDeployment);

    expect(await autheoNodeLicense1.isNodeHosted(owner.address, 1)).to.be.equal(
      false
    );

    await autheoCentralStore.updateKYCStatus(user1.address, true);
    await autheoCentralStore.updateKYCStatus(user2.address, true);
    await autheoCentralStore.updateKYCStatus(user3.address, true);
    await autheoCentralStore.updateKYCStatus(owner.address, true);

    const payment = ethers.parseUnits("9999000000000000000000", "wei");

    await autheoNodeLicense1.connect(user1).mint(100, "", { value: payment });

    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(100);
    expect(await autheoNodeLicense1.ownerOf(1)).to.be.equal(user1.address);
    expect(await autheoNodeLicense1.ownerOf(100)).to.be.equal(user1.address);

    await expect(
      autheoNodeLicense1
        .connect(user1)
        ["safeTransferFrom(address,address,uint256)"](
          user1.address,
          user2.address,
          1
        )
    ).to.be.revertedWith("NFT locked for 12 months");

    await expect(
      autheoNodeLicense1
        .connect(user1)
        ["safeTransferFrom(address,address,uint256,bytes)"](
          user1.address,
          user2.address,
          1,
          "0x"
        )
    ).to.be.revertedWith("NFT locked for 12 months");

    expect(await autheoNodeLicense1.isNodeHosted(user1.address, 1)).to.be.equal(
      false
    );
    expect(
      await autheoNodeLicense1.isNodeHosted(user1.address, 100)
    ).to.be.equal(false);

    await expect(
      autheoNodeLicense1.updateNodeHostedStatus(user2.address, 1, false)
    ).to.be.revertedWith("Holder is not an owner of token");
    await expect(
      autheoNodeLicense1.updateNodeHostedStatus(user1.address, 1, false)
    ).to.be.revertedWith("Node hosted status already updated");

    await expect(
      autheoNodeLicense1
        .connect(user1)
        ["safeTransferFrom(address,address,uint256,bytes)"](
          user1.address,
          user2.address,
          1,
          "0x"
        )
    ).to.be.revertedWith("NFT locked for 12 months");

    await expect(
      autheoNodeLicense1
        .connect(user1)
        .updateNodeHostedStatus(user1.address, 50, true)
    ).to.be.revertedWith("Unauthorized! Only admin can perform this operation");

    await autheoNodeLicense1
      .connect(owner)
      .updateNodeHostedStatus(user1.address, 50, true);

    await time.increase(31535995);

    await time.increase(1);

    await autheoNodeLicense1
      .connect(user1)
      ["safeTransferFrom(address,address,uint256,bytes)"](
        user1.address,
        user2.address,
        1,
        "0x"
      );

    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(99);
    expect(await autheoNodeLicense1.ownerOf(1)).to.be.equal(user2.address);
    expect(await autheoNodeLicense1.balanceOf(user2.address)).to.be.equal(1);

    await time.increase(31535995);

    await expect(
      autheoNodeLicense1
        .connect(user1)
        ["safeTransferFrom(address,address,uint256,bytes)"](
          user1.address,
          user2.address,
          50,
          "0x"
        )
    ).to.be.revertedWith("Node is hosted");

    await expect(
      autheoNodeLicense1
        .connect(owner)
        .updateNodeHostedStatus(user1.address, 50, true)
    ).to.be.revertedWith("Node hosted status already updated");

    await autheoNodeLicense1
      .connect(owner)
      .updateNodeHostedStatus(user1.address, 50, false);

    await autheoNodeLicense1
      .connect(user1)
      ["safeTransferFrom(address,address,uint256,bytes)"](
        user1.address,
        user2.address,
        50,
        "0x"
      );

    expect(await autheoNodeLicense1.balanceOf(user1.address)).to.be.equal(98);
    expect(await autheoNodeLicense1.ownerOf(50)).to.be.equal(user2.address);
    expect(await autheoNodeLicense1.balanceOf(user2.address)).to.be.equal(2);
  });
});
