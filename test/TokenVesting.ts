import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { TokenVesting as TokenVestingContract } from "../artifacts/typechain";
import { MockToken } from "../artifacts/typechain";
import { BigNumber } from "ethers";

describe("TokenVesting", function () {
  async function deployTokenAndVestingFixture() {
    const [owner, beneficiary] = await hre.ethers.getSigners();
    const VestingDuration = 365 * 24 * 60 * 60; // 1 year in seconds
    const VestingCliff = 30 * 24 * 60 * 60; // 30 days in seconds
    const VestingInterval = 30 * 24 * 60 * 60; // Monthly
    const TotalAmount = hre.ethers.utils.parseUnits("1000000000", 18); // 1000000000 tokens

    // Deploy an ERC20 Token
    const Token = await hre.ethers.getContractFactory("MockToken");
    const token: MockToken = await Token.deploy(
      "Test Token",
      "TT",
      hre.ethers.utils.parseUnits("1000000000", 18)
    );
    const tokenAddress = token.address;

    // Deploy the TokenVesting contract
    const TokenVesting = await hre.ethers.getContractFactory("TokenVesting");
    const start = await time.latest();
    const tokenVesting: TokenVestingContract = await TokenVesting.deploy(
      tokenAddress
    );
    const vestingAddress = tokenVesting.address;

    // Transfer tokens to the TokenVesting contract
    await token.transfer(vestingAddress, TotalAmount);

    // Create a vesting schedule
    await tokenVesting.createVestingSchedule(
      beneficiary.address,
      start,
      VestingCliff,
      VestingDuration,
      VestingInterval,
      true,
      TotalAmount
    );

    return {
      token,
      tokenVesting,
      owner,
      beneficiary,
      start,
      VestingDuration,
      VestingCliff,
      VestingInterval,
      TotalAmount,
    };
  }

  describe("Deployment", function () {
    it("Should deploy and set up the vesting schedule correctly", async function () {
      const {
        tokenVesting,
        beneficiary,
        start,
        VestingCliff,
        VestingDuration,
        VestingInterval,
        TotalAmount,
      } = await loadFixture(deployTokenAndVestingFixture);

      const vestingSchedule =
        await tokenVesting.getVestingScheduleByAddressAndIndex(
          beneficiary.address,
          0
        );
      expect(vestingSchedule.start).to.equal(start);
      expect(vestingSchedule.cliff).to.equal(start + VestingCliff);
      expect(vestingSchedule.vestingDuration).to.equal(VestingDuration);
      expect(vestingSchedule.vestingInterval).to.equal(VestingInterval);
      expect(vestingSchedule.totalAmount).to.equal(TotalAmount);
    });

    // Add more tests as needed for deployment checks
  });

  describe("Vesting Mechanism", function () {
    it("Should not allow token release before cliff", async function () {
      const { tokenVesting, beneficiary } = await loadFixture(
        deployTokenAndVestingFixture
      );

      const scheuldeId =
        await tokenVesting.getVestingScheduleIdForAddressAndIndex(
          beneficiary.address,
          0
        );

      await expect(tokenVesting.release(scheuldeId, 1)).to.be.revertedWith(
        "TokenVesting: cannot release tokens, not enough vested tokens"
      );
    });

    it("Should allow token release after cliff", async function () {
      const { tokenVesting, beneficiary, start, VestingCliff } =
        await loadFixture(deployTokenAndVestingFixture);

      const scheuldeId =
        await tokenVesting.getVestingScheduleIdForAddressAndIndex(
          beneficiary.address,
          0
        );

      // Move time to after the cliff period
      await time.increaseTo(start + VestingCliff + 1);

      // Attempt to release tokens after cliff has passed
      await expect(tokenVesting.connect(beneficiary).release(scheuldeId, 1)).not
        .to.be.reverted;
    });

    // Add more tests to cover all vesting scenarios
  });

  describe("TokenVesting Revocation", function () {
    it("Should allow revocation by owner and stop token releases post-revocation", async function () {
      const { tokenVesting, beneficiary, owner, start, VestingCliff } =
        await loadFixture(deployTokenAndVestingFixture);

      const scheduleId =
        await tokenVesting.getVestingScheduleIdForAddressAndIndex(
          beneficiary.address,
          0
        );

      // Move time to after the cliff but before revocation
      await time.increaseTo(start + VestingCliff + 1);

      // Ensure tokens can be released after cliff
      await expect(tokenVesting.connect(beneficiary).release(scheduleId, 1)).not
        .to.be.reverted;

      // Revoke the vesting schedule as the owner
      await expect(tokenVesting.connect(owner).revoke(scheduleId))
        .to.emit(tokenVesting, "VestingRevoked")
        .withArgs(scheduleId);

      // Attempt to release tokens after revocation should fail
      await expect(tokenVesting.connect(beneficiary).release(scheduleId, 1)).to
        .be.reverted;
    });

    it("Should not allow revocation by non-owner accounts", async function () {
      const { tokenVesting, beneficiary } = await loadFixture(
        deployTokenAndVestingFixture
      );
      const scheduleId =
        await tokenVesting.getVestingScheduleIdForAddressAndIndex(
          beneficiary.address,
          0
        );

      // Attempt to revoke the vesting schedule as a non-owner
      await expect(tokenVesting.connect(beneficiary).revoke(scheduleId)).to.be
        .reverted;
    });
  });

  describe("TokenVesting Complete Vesting", function () {
    it("Should allow the beneficiary to release all tokens after the vesting period ends", async function () {
      const { tokenVesting, beneficiary, start, VestingDuration, TotalAmount } =
        await loadFixture(deployTokenAndVestingFixture);
      const scheduleId =
        await tokenVesting.getVestingScheduleIdForAddressAndIndex(
          beneficiary.address,
          0
        );

      // Move time to after the complete vesting period
      await time.increaseTo(start + VestingDuration + 1);

      // Release all tokens
      await expect(
        tokenVesting.connect(beneficiary).release(scheduleId, TotalAmount)
      ).not.to.be.reverted;

      // Check that the entire amount has been released
      const vestingSchedule = await tokenVesting.getVestingSchedule(scheduleId);
      expect(vestingSchedule.releasedAmount).to.equal(TotalAmount);
    });
  });

  describe("TokenVesting Release Mechanism", function () {
    it("Should release the correct amount of tokens at different intervals", async function () {
      const {
        tokenVesting,
        beneficiary,
        start,
        VestingCliff,
        VestingInterval,
        TotalAmount,
      } = await loadFixture(deployTokenAndVestingFixture);
      const scheduleId =
        await tokenVesting.getVestingScheduleIdForAddressAndIndex(
          beneficiary.address,
          0
        );

      // Calculate the amount to be vested per interval
      const intervals = 12; // Assuming a monthly interval over a year for simplicity
      const amountPerInterval = TotalAmount.div(ethers.BigNumber.from(intervals));

      // Move time to the first release point after the cliff
      await time.increaseTo(start + VestingCliff + VestingInterval);

      // Attempt to release the first interval's worth of tokens
      await expect(
        tokenVesting.connect(beneficiary).release(scheduleId, amountPerInterval)
      ).not.to.be.reverted;

      // Check the released amount is correct
      let vestingSchedule = await tokenVesting.getVestingSchedule(scheduleId);
      expect(vestingSchedule.releasedAmount).to.equal(amountPerInterval);

      // Move time to the second release point
      await time.increaseTo(start + VestingCliff + 2 * VestingInterval);

      // Attempt to release the second interval's worth of tokens
      await expect(
        tokenVesting.connect(beneficiary).release(scheduleId, amountPerInterval)
      ).not.to.be.reverted;

      // Check the total released amount is correct
      vestingSchedule = await tokenVesting.getVestingSchedule(scheduleId);
      expect(vestingSchedule.releasedAmount).to.equal(
        amountPerInterval.mul(ethers.BigNumber.from(2))
      );
    });

    it("Should revert when trying to release more than the vested amount", async function () {
      const { tokenVesting, beneficiary, start, VestingDuration } =
        await loadFixture(deployTokenAndVestingFixture);
      const scheduleId =
        await tokenVesting.getVestingScheduleIdForAddressAndIndex(
          beneficiary.address,
          0
        );

      // Move time to halfway through the vesting duration
      const halfwayPoint = start + VestingDuration / 2;
      await time.increaseTo(halfwayPoint);

      // Attempt to release more than the expected vested amount at this point
      const tooMuchAmount =
        // (await tokenVesting.totalAmount()) / BigInt(2) + BigInt(1); // More than half
        (await tokenVesting.totalAmount()).div(BigNumber.from(2)).add(ethers.BigNumber.from(1)); // More than half

      await expect(
        tokenVesting.connect(beneficiary).release(scheduleId, tooMuchAmount)
      ).to.be.revertedWith(
        "TokenVesting: cannot release tokens, not enough vested tokens"
      );
    });

    it("Should not release more tokens than the total vested amount over the vesting period", async function () {
      const { tokenVesting, beneficiary, start, VestingDuration, TotalAmount } =
        await loadFixture(deployTokenAndVestingFixture);
      const scheduleId =
        await tokenVesting.getVestingScheduleIdForAddressAndIndex(
          beneficiary.address,
          0
        );

      // Move time to after the complete vesting period
      await time.increaseTo(start + VestingDuration + 1);

      // Attempt to release more tokens than the total vested amount
      // const excessiveAmount = TotalAmount + BigInt(1000);
      const excessiveAmount = TotalAmount.add(ethers.BigNumber.from(1000));
      // Total amount + some extra
      await expect(
        tokenVesting.connect(beneficiary).release(scheduleId, excessiveAmount)
      ).to.be.revertedWith(
        "TokenVesting: cannot release tokens, not enough vested tokens"
      );

      // Ensure the correct total amount can be released without reverting
      await expect(
        tokenVesting.connect(beneficiary).release(scheduleId, TotalAmount)
      ).not.to.be.reverted;

      // Check the released amount matches the total vested amount
      const vestingSchedule = await tokenVesting.getVestingSchedule(scheduleId);
      expect(vestingSchedule.releasedAmount).to.equal(TotalAmount);
    });
  });
});
