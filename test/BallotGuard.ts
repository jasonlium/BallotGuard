import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { BallotGuard, BallotGuard__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("BallotGuard")) as BallotGuard__factory;
  const ballotGuard = (await factory.deploy()) as BallotGuard;
  const ballotGuardAddress = await ballotGuard.getAddress();

  return { ballotGuard, ballotGuardAddress };
}

describe("BallotGuard", () => {
  let signers: Signers;
  let ballotGuard: BallotGuard;
  let ballotGuardAddress: string;

  before(async () => {
    const signerList = await ethers.getSigners();
    signers = {
      deployer: signerList[0],
      alice: signerList[1],
      bob: signerList[2],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    ({ ballotGuard, ballotGuardAddress } = await deployFixture());
  });

  async function createPoll() {
    const latestBlock = await ethers.provider.getBlock("latest");
    const start = latestBlock?.timestamp ?? Math.floor(Date.now() / 1000);
    const end = start + 3600;
    await ballotGuard
      .connect(signers.deployer)
      .createPoll("Election", "Choose wisely", ["Alpha", "Beta", "Gamma"], start, end);
    return { pollId: 0, endTimestamp: end };
  }

  async function encryptChoice(voter: HardhatEthersSigner, choice: number) {
    return fhevm.createEncryptedInput(ballotGuardAddress, voter.address).add32(choice).encrypt();
  }

  it("records encrypted votes and publishes verified tallies", async () => {
    const { pollId, endTimestamp } = await createPoll();

    // Alice votes for option 1
    const aliceVote = await encryptChoice(signers.alice, 1);
    await ballotGuard
      .connect(signers.alice)
      .submitVote(pollId, aliceVote.handles[0], aliceVote.inputProof);

    // Bob votes for option 2
    const bobVote = await encryptChoice(signers.bob, 2);
    await ballotGuard
      .connect(signers.bob)
      .submitVote(pollId, bobVote.handles[0], bobVote.inputProof);

    const hasAliceVoted = await ballotGuard.hasVoted(pollId, signers.alice.address);
    const hasBobVoted = await ballotGuard.hasVoted(pollId, signers.bob.address);
    expect(hasAliceVoted).to.eq(true);
    expect(hasBobVoted).to.eq(true);

    await time.increaseTo(endTimestamp + 1);

    await ballotGuard.finalizePoll(pollId);

    const encryptedTallies = await ballotGuard.getEncryptedResults(pollId);
    const handles = encryptedTallies.map((handle: string) => handle);

    const publicDecryption = await fhevm.publicDecrypt(handles);
    await ballotGuard.submitDecryptedResults(
      pollId,
      publicDecryption.abiEncodedClearValues,
      publicDecryption.decryptionProof,
    );

    const clearResults = await ballotGuard.getDecryptedResults(pollId);
    expect(clearResults.map((value: bigint) => Number(value))).to.deep.equal([0, 1, 1]);
  });

  it("enforces poll validation rules", async () => {
    const latestBlock = await ethers.provider.getBlock("latest");
    const start = latestBlock?.timestamp ?? Math.floor(Date.now() / 1000);
    const end = start + 600;

    await expect(
      ballotGuard.connect(signers.deployer).createPoll("Bad Poll", "No options", ["OnlyOne"], start, end),
    ).to.be.revertedWithCustomError(ballotGuard, "InvalidOptionCount");

    await ballotGuard
      .connect(signers.deployer)
      .createPoll("Strict Vote", "Two options only", ["Yes", "No"], start, end);

    const encryptedInput = await encryptChoice(signers.alice, 0);
    await ballotGuard
      .connect(signers.alice)
      .submitVote(0, encryptedInput.handles[0], encryptedInput.inputProof);

    await expect(
      ballotGuard
        .connect(signers.alice)
        .submitVote(0, encryptedInput.handles[0], encryptedInput.inputProof),
    ).to.be.revertedWithCustomError(ballotGuard, "AlreadyVoted");

    await expect(ballotGuard.finalizePoll(0)).to.be.revertedWithCustomError(ballotGuard, "PollStillRunning");

    await expect(
      ballotGuard.submitDecryptedResults(0, ethers.ZeroHash, ethers.ZeroHash),
    ).to.be.revertedWithCustomError(ballotGuard, "PollNotFinalized");
  });
});
