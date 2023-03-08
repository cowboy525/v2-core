// import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// import { ethers } from "hardhat";
// import { advanceTimeAndBlock } from "../../scripts/utils";
// import { MultiFeeDistribution } from "../../typechain-types";
// import _ from "lodash";
// import chai from "chai";
// import { solidity } from "ethereum-waffle";
// import { DeployData } from "../../scripts/deploy/types";
// import {
//   deployAndSetup,
//   depositAndBorrowAll,
//   zapIntoEligibility,
// } from "../shared/helpers";
// import { PriceProvider } from "../../typechain-types/contracts/price";
// import { AutoCompounder } from "../../typechain-types/contracts/compounder/AutoCompounder";
// import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// chai.use(solidity);

// describe("Compounding", () => {
//   let user2: SignerWithAddress;
//   let user3: SignerWithAddress;

//   let mfd: MultiFeeDistribution;
//   let lpFeeDistribution: MultiFeeDistribution;
//   let LOCK_DURATION = 0;

//   let priceProvider: PriceProvider;
//   let autocompounder: AutoCompounder;

//   let REWARDS_DURATION = 0;

//   let deployData: DeployData;

//   beforeEach(async () => {
//     const fixture = await loadFixture(deployAndSetup);

//     deployData = fixture.deployData;

//     user2 = fixture.user2;
//     user3 = fixture.user3;

//     mfd = fixture.multiFeeDistribution;
//     lpFeeDistribution = fixture.lpFeeDistribution;
//     priceProvider = fixture.priceProvider;

//     autocompounder = <AutoCompounder>(
//       await ethers.getContractAt("AutoCompounder", deployData.autocompounder)
//     );

//     REWARDS_DURATION = (await mfd.REWARDS_DURATION()).toNumber();
//     LOCK_DURATION = (await mfd.DEFAULT_LOCK_DURATION()).toNumber();
//   });

//   it("autocompound", async () => {
//     const bigDepositor = user2;
//     const locker = user3;

//     await depositAndBorrowAll(bigDepositor, ["100", "100000"], deployData);

//     await zapIntoEligibility(locker, deployData, "10");

//     await advanceTimeAndBlock(LOCK_DURATION / 4);
//     await depositAndBorrowAll(bigDepositor, ["1000", "10000000"], deployData);

//     await advanceTimeAndBlock(LOCK_DURATION / 4);
//     await depositAndBorrowAll(bigDepositor, ["1000", "10000000"], deployData);

//     await advanceTimeAndBlock(LOCK_DURATION / 4);

//     await depositAndBorrowAll(bigDepositor, ["1000", "10000000"], deployData);

//     await lpFeeDistribution.connect(locker).getAllRewards();

//     await advanceTimeAndBlock(LOCK_DURATION / 4);

//     let locked = await lpFeeDistribution.lockedBalances(locker.address);
//     // console.log(locked);
//     let reward = await lpFeeDistribution.claimableRewards(locker.address);
//     // console.log(reward);

//     await autocompounder.connect(locker).swapRewardsToLp();

//     locked = await lpFeeDistribution.lockedBalances(locker.address);
//     // console.log(locked);
//     reward = await lpFeeDistribution.claimableRewards(locker.address);
//     // console.log(reward);

//     // TODO: check values
//   });
// });
