import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:ballot-address", "Prints the BallotGuard address").setAction(async (_taskArguments: TaskArguments, hre) => {
  const { deployments } = hre;
  const deployment = await deployments.get("BallotGuard");
  console.log(`BallotGuard address: ${deployment.address}`);
});

task("task:poll-count", "Shows how many polls exist").setAction(async (_taskArguments: TaskArguments, hre) => {
  const { deployments, ethers } = hre;
  const deployment = await deployments.get("BallotGuard");
  const contract = await ethers.getContractAt("BallotGuard", deployment.address);
  const count = await contract.pollCount();
  console.log(`Total polls: ${count}`);
});

task("task:get-poll", "Displays poll metadata and options")
  .addParam("poll", "Poll id")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const pollId = Number(taskArguments.poll);
    if (!Number.isInteger(pollId)) {
      throw new Error("poll must be an integer id");
    }

    const { deployments, ethers } = hre;
    const deployment = await deployments.get("BallotGuard");
    const contract = await ethers.getContractAt("BallotGuard", deployment.address);

    const poll = await contract.getPoll(pollId);
    console.log(`Poll #${pollId}`);
    console.log(` Title       : ${poll[0]}`);
    console.log(` Description : ${poll[1]}`);
    console.log(` Start       : ${poll[3]}`);
    console.log(` End         : ${poll[4]}`);
    console.log(` Finalized   : ${poll[5]}`);
    console.log(` Results set : ${poll[6]}`);
    console.log(` Creator     : ${poll[7]}`);
    console.log(" Options:");
    poll[2].forEach((option: string, idx: number) => {
      console.log(`   [${idx}] ${option}`);
    });
  });

task("task:create-poll", "Creates a new confidential poll")
  .addParam("title", "Poll title")
  .addParam("options", "Comma separated options (2-4 entries)")
  .addParam("start", "Start timestamp (seconds)")
  .addParam("end", "End timestamp (seconds)")
  .addOptionalParam("description", "Optional description", "")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const { deployments, ethers } = hre;
    const deployment = await deployments.get("BallotGuard");
    const contract = await ethers.getContractAt("BallotGuard", deployment.address);
    const [signer] = await ethers.getSigners();

    const options = String(taskArguments.options)
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    const start = Number(taskArguments.start);
    const end = Number(taskArguments.end);

    if (options.length < 2 || options.length > 4) {
      throw new Error("options must contain between 2 and 4 values");
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isInteger(start) || !Number.isInteger(end)) {
      throw new Error("start and end must be integer timestamps");
    }

    const title = String(taskArguments.title);
    const description = taskArguments.description ? String(taskArguments.description) : "";

    console.log(`Creating poll "${title}" with options ${options.join(", ")}`);
    const tx = await contract
      .connect(signer)
      .createPoll(title, description, options, start, end);
    console.log(`Waiting for tx ${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`Poll created in block ${receipt?.blockNumber}`);
  });

task("task:vote", "Casts an encrypted vote for a poll")
  .addParam("poll", "Poll id")
  .addParam("choice", "Selected option index (0-based)")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const pollId = Number(taskArguments.poll);
    const choice = Number(taskArguments.choice);
    if (!Number.isInteger(pollId) || !Number.isInteger(choice)) {
      throw new Error("poll and choice must be integers");
    }

    const { deployments, ethers, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("BallotGuard");
    const contract = await ethers.getContractAt("BallotGuard", deployment.address);
    const [signer] = await ethers.getSigners();

    const encryptedChoice = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add32(choice)
      .encrypt();

    const tx = await contract
      .connect(signer)
      .submitVote(pollId, encryptedChoice.handles[0], encryptedChoice.inputProof);
    console.log(`Submitted vote in tx ${tx.hash}`);
    await tx.wait();
  });

task("task:finalize", "Finalizes a poll so tallies become publicly decryptable")
  .addParam("poll", "Poll id")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const pollId = Number(taskArguments.poll);
    if (!Number.isInteger(pollId)) {
      throw new Error("poll must be integer");
    }

    const { deployments, ethers } = hre;
    const deployment = await deployments.get("BallotGuard");
    const contract = await ethers.getContractAt("BallotGuard", deployment.address);
    const [signer] = await ethers.getSigners();

    const tx = await contract.connect(signer).finalizePoll(pollId);
    console.log(`Finalizing poll in tx ${tx.hash}`);
    await tx.wait();
  });

task("task:submit-results", "Stores decrypted tallies on-chain after verification")
  .addParam("poll", "Poll id")
  .addParam("encoded", "ABI encoded clear results returned by publicDecrypt")
  .addParam("proof", "decryption proof returned by publicDecrypt")
  .setAction(async (taskArguments: TaskArguments, hre) => {
    const pollId = Number(taskArguments.poll);
    if (!Number.isInteger(pollId)) {
      throw new Error("poll must be integer");
    }

    const { deployments, ethers } = hre;
    const deployment = await deployments.get("BallotGuard");
    const contract = await ethers.getContractAt("BallotGuard", deployment.address);
    const [signer] = await ethers.getSigners();

    const encoded = String(taskArguments.encoded);
    const proof = String(taskArguments.proof);

    const tx = await contract.connect(signer).submitDecryptedResults(pollId, encoded, proof);
    console.log(`Submitting verified results in tx ${tx.hash}`);
    await tx.wait();
  });
