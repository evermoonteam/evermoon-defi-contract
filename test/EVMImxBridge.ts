import { ethers } from "hardhat";
import { EVMBridgeLocker__factory, EvermoonBridgeToken__factory, Mintable__factory } from "../artifacts/typechain";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

describe("Bridge", async function () {
    async function deployAllContractsFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();

        const EvermoonBridgeTokenFactory = await ethers.getContractFactory(
            "contracts/EvermoonBridgeToken.sol:EvermoonBridgeToken"
        ) as EvermoonBridgeToken__factory;
        const evermoonBridgeToken = await EvermoonBridgeTokenFactory.deploy(owner.address);

        const BridgeLocker = await ethers.getContractFactory(
            "contracts/EVMBridgeLocker.sol:EVMBridgeLocker"
        ) as EVMBridgeLocker__factory;
        const bridgeLocker = await BridgeLocker.deploy(owner.address, evermoonBridgeToken.address);

        const ownerRole = await bridgeLocker.OWNER_ROLE();
        expect(await bridgeLocker.hasRole(ownerRole, owner.address)).be.true;

        const minterRole = await evermoonBridgeToken.MINTER_ROLE();
        expect(await evermoonBridgeToken.connect(owner).grantMinterRole(bridgeLocker.address)).not.to.be.reverted;
        expect(await evermoonBridgeToken.hasRole(minterRole, bridgeLocker.address)).to.be.true;

        return { evermoonBridgeToken, bridgeLocker };
    }

    it("deployment should success", async function () {
        const { bridgeLocker, evermoonBridgeToken } = await loadFixture(deployAllContractsFixture);
        expect(bridgeLocker.address).to.be.properAddress;
        expect(evermoonBridgeToken.address).to.be.properAddress;
    })

    it("lock token should be success", async function () {
        const [owner, otherAccount] = await ethers.getSigners();
        const { bridgeLocker, evermoonBridgeToken } = await loadFixture(deployAllContractsFixture);

        expect(await bridgeLocker.connect(owner).lockToken(otherAccount.address, ethers.utils.parseEther("1"))).not.to.be.reverted;
        expect(await evermoonBridgeToken.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("1"));
        expect(await evermoonBridgeToken.totalSupply()).to.equal(ethers.utils.parseEther("1"));
    });

    it("unlock token should be success", async function () {
        const [owner, otherAccount] = await ethers.getSigners();
        const { bridgeLocker, evermoonBridgeToken } = await loadFixture(deployAllContractsFixture);

        expect(await bridgeLocker.connect(owner).lockToken(otherAccount.address, ethers.utils.parseEther("1"))).not.to.be.reverted;
        expect(await evermoonBridgeToken.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("1"));
        expect(await evermoonBridgeToken.totalSupply()).to.equal(ethers.utils.parseEther("1"));

        expect(await evermoonBridgeToken.connect(otherAccount).approve(bridgeLocker.address, ethers.utils.parseEther("0.4"))).not.to.be.reverted;

        expect(await bridgeLocker.connect(otherAccount).unlockToken(ethers.utils.parseEther("0.4"))).not.to.be.reverted;
        expect(await evermoonBridgeToken.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("0.6"));
        expect(await evermoonBridgeToken.totalSupply()).to.equal(ethers.utils.parseEther("0.6"));
    });

    it("unlock token while balance is not enough should fail", async function () {
        const [owner, otherAccount] = await ethers.getSigners();
        const { bridgeLocker, evermoonBridgeToken } = await loadFixture(deployAllContractsFixture);
        expect(await bridgeLocker.connect(owner).lockToken(otherAccount.address, ethers.utils.parseEther("1"))).not.to.be.reverted;
        expect(await evermoonBridgeToken.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("1"));
        expect(await evermoonBridgeToken.totalSupply()).to.equal(ethers.utils.parseEther("1"));

        expect(await evermoonBridgeToken.connect(otherAccount).approve(bridgeLocker.address, ethers.utils.parseEther("100"))).not.to.be.revertedWith("Insufficient balance");

        await expect(bridgeLocker.connect(otherAccount).unlockToken(ethers.utils.parseEther("100"))).to.be.reverted;
        expect(await evermoonBridgeToken.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("1"));
        expect(await evermoonBridgeToken.totalSupply()).to.equal(ethers.utils.parseEther("1"));
    });

    it("after granting OWNER_ROLE to other account, that account must be able to call lockToken", async function () {
        const [owner, otherAccount, otherMinter] = await ethers.getSigners();
        const { bridgeLocker, evermoonBridgeToken } = await loadFixture(deployAllContractsFixture);
        expect(await bridgeLocker.connect(owner).lockToken(otherAccount.address, ethers.utils.parseEther("1"))).not.to.be.reverted;
        expect(await evermoonBridgeToken.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("1"));
        expect(await evermoonBridgeToken.totalSupply()).to.equal(ethers.utils.parseEther("1"));

        const ownerRole = await bridgeLocker.OWNER_ROLE();
        expect(await bridgeLocker.connect(owner).grantRole(ownerRole, otherMinter.address)).to.not.be.reverted;
        expect(await bridgeLocker.connect(otherMinter).lockToken(otherAccount.address, ethers.utils.parseEther("1"))).not.to.be.reverted;
        expect(await evermoonBridgeToken.balanceOf(otherAccount.address)).to.equal(ethers.utils.parseEther("2"));
        expect(await evermoonBridgeToken.totalSupply()).to.equal(ethers.utils.parseEther("2"));
    });

})