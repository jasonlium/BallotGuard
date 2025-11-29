# BallotGuard

BallotGuard is a fully homomorphic encryption (FHE) powered polling dApp built on the Zama FHEVM stack and deployed to Sepolia. It lets anyone create time-boxed polls, collect encrypted votes, finalize tallies, verify decryption proofs, and publish results on-chain without ever exposing individual choices.

## Why BallotGuard
- Protects voter privacy by keeping every ballot encrypted end-to-end.
- Enforces fair voting windows (start/end) and prevents double voting.
- Publishes only verified results: decryption proofs are checked on-chain before storage.
- Lightweight poll creation (2–4 options) so communities can spin up decisions quickly.
- Works with a familiar web UI backed by RainbowKit, wagmi/viem reads, and ethers-based writes.

## What It Solves
- **Confidentiality**: Votes are never visible in plaintext on-chain; tallies stay encrypted until finalization.
- **Integrity**: Decryption proofs are validated with `FHE.checkSignatures`, blocking tampered tallies.
- **Transparency**: Final results and proofs are published on-chain for anyone to audit.
- **Usability**: Non-technical creators can launch polls and push results on-chain from the UI or CLI tasks.

## Core Capabilities
- Create polls with a title, description, 2–4 options, and start/end timestamps.
- Cast a single encrypted vote per address during the active window.
- Finalize polls after the deadline to make tallies publicly decryptable.
- Run public decryption, then submit verified clear results plus proof on-chain.
- Query live poll metadata, encrypted tallies, verified results, and per-address vote status.

## Architecture
- **Smart contract** (`contracts/BallotGuard.sol`):  
  - Stores poll metadata, encrypted option counts (`euint32[]`), and verified clear counts.  
  - Validates inputs (non-empty title/options, 2–4 options, future end time).  
  - Prevents double voting and blocks late/early submissions.  
  - Finalization calls `FHE.makePubliclyDecryptable` so relayers can decrypt tallies.  
  - `submitDecryptedResults` checks signatures with `FHE.checkSignatures`, decodes clear counts, and emits `ResultsPublished`.
- **Hardhat tasks** (`tasks/ballotGuard.ts`): Helpers to create polls, vote with encrypted inputs, finalize, and push decrypted results.
- **Frontend** (`src/`): React + Vite app using RainbowKit for wallets, wagmi/viem for reads, ethers for writes, and Zama relayer SDK for encryption/decryption. Users can create polls, vote, finalize, decrypt, and publish results without leaving the UI.
- **Deployments & ABI**: Generated ABIs live under `deployments/` (e.g., `deployments/sepolia/BallotGuard.json`) and are copied into `src/src/config/contracts.ts` for the frontend.

## Tech Stack
- **Contracts**: Solidity 0.8.27, Zama FHEVM Solidity library, Hardhat + TypeScript, hardhat-deploy, hardhat-gas-reporter, solidity-coverage.
- **Frontend**: React, Vite, RainbowKit, wagmi/viem (reads), ethers (writes), Zama relayer SDK.
- **Tooling**: TypeChain (ethers v6), ESLint/Prettier/Solhint, Mocha/Chai tests.
- **Network**: Hardhat/anvil for local dev; Sepolia via Infura for testnet.

## Repository Layout
```
contracts/       BallotGuard smart contract
deploy/          Hardhat deploy scripts
deployments/     Saved deployments and ABIs (used by the frontend)
tasks/           Hardhat tasks (poll ops, voting, finalization, publishing)
test/            Contract tests (FHEVM mock flow)
src/             Frontend (Vite React app under src/src)
docs/            Zama FHEVM and relayer references
```

## Poll Lifecycle
1. **Create**: `createPoll(title, description, options[2-4], start, end)` stores metadata and zeroed encrypted tallies. End time must be in the future.
2. **Vote**: Users encrypt their choice with the Zama relayer (`createEncryptedInput`) and call `submitVote`. Contract prevents double voting and enforces the schedule.
3. **Finalize**: After `endTime`, anyone can call `finalizePoll` to mark the poll finished and allow public decryption of tallies.
4. **Decrypt**: Anyone can call `publicDecrypt` (via relayer or CLI) on the encrypted tallies to obtain clear counts plus a decryption proof.
5. **Publish**: `submitDecryptedResults` verifies signatures, stores clear counts, and exposes encoded results + proof through `getDecryptedResults` and `getResultVerification`.

## Getting Started
### Prerequisites
- Node.js >= 20
- npm

### Install dependencies
```bash
# Contracts and tasks
npm install

# Frontend
cd src
npm install
```

### Environment variables (contracts)
Create `.env` in the repo root with:
```
INFURA_API_KEY=<your_infura_key>
PRIVATE_KEY=<deployer_private_key>
ETHERSCAN_API_KEY=<optional_for_verification>
```
Mnemonic deployment is not supported; use the private key.

### Build and test contracts
```bash
npm run compile
npm run test           # uses the FHEVM mock
npm run coverage       # optional
npm run lint           # solhint + eslint + prettier checks
```

### Local development
```bash
npm run chain                # start Hardhat node
npm run deploy:localhost     # deploy BallotGuard locally
```

### Hardhat tasks (examples)
```bash
npx hardhat task:ballot-address --network sepolia
npx hardhat task:create-poll --title "Launch vote" --options "Yes,No" --start <start_ts> --end <end_ts> --network sepolia
npx hardhat task:vote --poll 0 --choice 1 --network sepolia
npx hardhat task:finalize --poll 0 --network sepolia
npx hardhat task:submit-results --poll 0 --encoded <abiEncodedCounts> --proof <proof> --network sepolia
```

### Deployment to Sepolia
```bash
npm run deploy:sepolia
# Optional verification
npm run verify:sepolia -- --contract contracts/BallotGuard.sol:BallotGuard <deployed_address>
```
The deployment artifact and ABI will be saved under `deployments/sepolia/BallotGuard.json`; copy its ABI and address into `src/src/config/contracts.ts` for the frontend.

### Frontend usage
1. Update `src/src/config/contracts.ts` with the deployed BallotGuard address and ABI from `deployments/sepolia/BallotGuard.json`.
2. Set a WalletConnect project ID in `src/src/config/wagmi.ts`.
3. Run the app:
   ```bash
   cd src
   npm run dev
   ```
   Connect a wallet on Sepolia, create a poll, vote, finalize, decrypt tallies via the relayer, and publish results on-chain.

## Testing and Verification
- Unit tests (`test/BallotGuard.ts`) exercise the full voting flow with mocked FHEVM: create, vote, finalize, decrypt, and publish.
- Gas reporting (`REPORT_GAS=1 npm run test`) and coverage are available for contract QA.
- Tasks mirror UI flows, enabling end-to-end checks against live networks.

## Future Plans
- Enhance UI observability (per-option progress, countdowns, event streams).
- Batch finalization and result submissions for multiple polls in one transaction.
- Adminless upgrades: optional guardianless mode using on-chain automation for finalize/decrypt triggers.
- Extended poll types (ranked choice, multi-select) using higher-bit encrypted counters.
- Additional attestations (e.g., merkle proofs of voter eligibility) layered on top of encrypted ballots.

## License
BSD-3-Clause-Clear. See `LICENSE` for full terms.
