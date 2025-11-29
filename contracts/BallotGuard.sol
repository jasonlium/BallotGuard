// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract BallotGuard is ZamaEthereumConfig {
    uint8 private constant MIN_OPTIONS = 2;
    uint8 private constant MAX_OPTIONS = 4;

    struct Poll {
        string title;
        string description;
        string[] options;
        uint64 startTime;
        uint64 endTime;
        bool finalized;
        bool resultsSubmitted;
        address creator;
        euint32[] encryptedCounts;
        uint32[] decryptedCounts;
        bytes encodedClearResults;
        bytes decryptionProof;
    }

    error PollNotFound(uint256 pollId);
    error InvalidOptionCount();
    error EmptyOption();
    error EmptyTitle();
    error InvalidSchedule();
    error VotingNotStarted(uint256 pollId);
    error VotingFinished(uint256 pollId);
    error AlreadyVoted(uint256 pollId, address voter);
    error PollStillRunning(uint256 pollId);
    error PollAlreadyFinalized(uint256 pollId);
    error ResultsAlreadySubmitted(uint256 pollId);
    error PollNotFinalized(uint256 pollId);
    error InvalidResultsLength(uint256 pollId);
    error CountExceedsLimit(uint256 pollId, uint256 index);

    event PollCreated(uint256 indexed pollId, address indexed creator, string title);
    event VoteSubmitted(uint256 indexed pollId, address indexed voter);
    event PollFinalized(uint256 indexed pollId, address indexed caller);
    event ResultsPublished(uint256 indexed pollId, uint32[] clearResults);

    uint256 public pollCount;
    mapping(uint256 => Poll) private polls;
    mapping(uint256 => mapping(address => bool)) private pollVotes;

    constructor() {}

    function createPoll(
        string calldata title,
        string calldata description,
        string[] calldata options,
        uint64 startTime,
        uint64 endTime
    ) external returns (uint256) {
        if (bytes(title).length == 0) {
            revert EmptyTitle();
        }
        if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
            revert InvalidOptionCount();
        }
        if (endTime <= startTime || endTime <= block.timestamp) {
            revert InvalidSchedule();
        }

        uint256 pollId = pollCount;
        pollCount += 1;

        Poll storage poll = polls[pollId];
        poll.title = title;
        poll.description = description;
        poll.startTime = startTime;
        poll.endTime = endTime;
        poll.creator = msg.sender;

        for (uint256 i = 0; i < options.length; ++i) {
            if (bytes(options[i]).length == 0) {
                revert EmptyOption();
            }
            poll.options.push(options[i]);
            poll.encryptedCounts.push();
        }

        emit PollCreated(pollId, msg.sender, title);
        return pollId;
    }

    function submitVote(uint256 pollId, externalEuint32 encryptedChoice, bytes calldata inputProof) external {
        Poll storage poll = polls[pollId];
        _ensurePollExists(poll, pollId);

        if (block.timestamp < poll.startTime) {
            revert VotingNotStarted(pollId);
        }
        if (block.timestamp > poll.endTime) {
            revert VotingFinished(pollId);
        }
        if (pollVotes[pollId][msg.sender]) {
            revert AlreadyVoted(pollId, msg.sender);
        }

        pollVotes[pollId][msg.sender] = true;

        euint32 choice = FHE.fromExternal(encryptedChoice, inputProof);
        uint256 optionCount = poll.options.length;

        euint32 zeroIncrement = FHE.asEuint32(0);
        euint32 oneIncrement = FHE.asEuint32(1);
        for (uint256 i = 0; i < optionCount; ++i) {
            ebool isTarget = FHE.eq(choice, FHE.asEuint32(uint32(i)));
            euint32 increment = FHE.select(isTarget, oneIncrement, zeroIncrement);
            poll.encryptedCounts[i] = FHE.add(poll.encryptedCounts[i], increment);
            FHE.allowThis(poll.encryptedCounts[i]);
        }

        emit VoteSubmitted(pollId, msg.sender);
    }

    function finalizePoll(uint256 pollId) external {
        Poll storage poll = polls[pollId];
        _ensurePollExists(poll, pollId);

        if (block.timestamp <= poll.endTime) {
            revert PollStillRunning(pollId);
        }
        if (poll.finalized) {
            revert PollAlreadyFinalized(pollId);
        }

        poll.finalized = true;

        uint256 optionCount = poll.encryptedCounts.length;
        for (uint256 i = 0; i < optionCount; ++i) {
            FHE.makePubliclyDecryptable(poll.encryptedCounts[i]);
        }

        emit PollFinalized(pollId, msg.sender);
    }

    function submitDecryptedResults(
        uint256 pollId,
        bytes calldata encodedCounts,
        bytes calldata decryptionProof
    ) external {
        Poll storage poll = polls[pollId];
        _ensurePollExists(poll, pollId);

        if (!poll.finalized) {
            revert PollNotFinalized(pollId);
        }
        if (poll.resultsSubmitted) {
            revert ResultsAlreadySubmitted(pollId);
        }

        uint256 optionCount = poll.encryptedCounts.length;
        bytes32[] memory handles = new bytes32[](optionCount);
        for (uint256 i = 0; i < optionCount; ++i) {
            handles[i] = euint32.unwrap(poll.encryptedCounts[i]);
        }

        FHE.checkSignatures(handles, encodedCounts, decryptionProof);

        uint256[] memory decodedCounts = _decodeClearValues(encodedCounts, optionCount, pollId);

        delete poll.decryptedCounts;
        for (uint256 i = 0; i < optionCount; ++i) {
            if (decodedCounts[i] > type(uint32).max) {
                revert CountExceedsLimit(pollId, i);
            }
            poll.decryptedCounts.push(uint32(decodedCounts[i]));
        }

        poll.encodedClearResults = encodedCounts;
        poll.decryptionProof = decryptionProof;
        poll.resultsSubmitted = true;

        emit ResultsPublished(pollId, poll.decryptedCounts);
    }

    function getPoll(uint256 pollId)
        external
        view
        returns (
            string memory title,
            string memory description,
            string[] memory options,
            uint64 startTime,
            uint64 endTime,
            bool finalized,
            bool resultsSubmitted,
            address creator
        )
    {
        Poll storage poll = polls[pollId];
        _ensurePollExists(poll, pollId);

        string[] memory optionList = _copyOptions(poll);
        return (
            poll.title,
            poll.description,
            optionList,
            poll.startTime,
            poll.endTime,
            poll.finalized,
            poll.resultsSubmitted,
            poll.creator
        );
    }

    function getEncryptedResults(uint256 pollId) external view returns (euint32[] memory tallies) {
        Poll storage poll = polls[pollId];
        _ensurePollExists(poll, pollId);

        uint256 optionCount = poll.encryptedCounts.length;
        tallies = new euint32[](optionCount);
        for (uint256 i = 0; i < optionCount; ++i) {
            tallies[i] = poll.encryptedCounts[i];
        }
    }

    function getDecryptedResults(uint256 pollId) external view returns (uint32[] memory results) {
        Poll storage poll = polls[pollId];
        _ensurePollExists(poll, pollId);

        require(poll.resultsSubmitted, "RESULTS_NOT_AVAILABLE");
        uint256 optionCount = poll.decryptedCounts.length;
        results = new uint32[](optionCount);
        for (uint256 i = 0; i < optionCount; ++i) {
            results[i] = poll.decryptedCounts[i];
        }
    }

    function getResultVerification(
        uint256 pollId
    ) external view returns (bytes memory encodedResults, bytes memory proof) {
        Poll storage poll = polls[pollId];
        _ensurePollExists(poll, pollId);

        require(poll.resultsSubmitted, "RESULTS_NOT_AVAILABLE");
        return (poll.encodedClearResults, poll.decryptionProof);
    }

    function hasVoted(uint256 pollId, address account) external view returns (bool) {
        return pollVotes[pollId][account];
    }

    function _copyOptions(Poll storage poll) private view returns (string[] memory optionList) {
        optionList = new string[](poll.options.length);
        for (uint256 i = 0; i < optionList.length; ++i) {
            optionList[i] = poll.options[i];
        }
    }

    function _ensurePollExists(Poll storage poll, uint256 pollId) private view {
        if (poll.options.length == 0) {
            revert PollNotFound(pollId);
        }
    }

    function _decodeClearValues(
        bytes memory encodedValues,
        uint256 expectedLength,
        uint256 pollId
    ) private pure returns (uint256[] memory values) {
        if (encodedValues.length != expectedLength * 32) {
            revert InvalidResultsLength(pollId);
        }

        values = new uint256[](expectedLength);
        for (uint256 i = 0; i < expectedLength; ++i) {
            uint256 decodedValue;
            assembly {
                decodedValue := mload(add(add(encodedValues, 0x20), mul(i, 0x20)))
            }
            values[i] = decodedValue;
        }
    }
}
