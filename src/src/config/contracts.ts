// BallotGuard contract deployed on Sepolia
export const CONTRACT_ADDRESS = '0xd517870f4613444196a9C826f104f89F5daB80B5' as const;

// ABI copied from deployments/sepolia/BallotGuard.json
export const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "voter",
        "type": "address"
      }
    ],
    "name": "AlreadyVoted",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      }
    ],
    "name": "CountExceedsLimit",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EmptyOption",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EmptyTitle",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidKMSSignatures",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidOptionCount",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      }
    ],
    "name": "InvalidResultsLength",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidSchedule",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      }
    ],
    "name": "PollAlreadyFinalized",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      }
    ],
    "name": "PollNotFinalized",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      }
    ],
    "name": "PollNotFound",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      }
    ],
    "name": "PollStillRunning",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      }
    ],
    "name": "ResultsAlreadySubmitted",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      }
    ],
    "name": "VotingFinished",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      }
    ],
    "name": "VotingNotStarted",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "title",
        "type": "string"
      }
    ],
    "name": "PollCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "caller",
        "type": "address"
      }
    ],
    "name": "PollFinalized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "voter",
        "type": "address"
      }
    ],
    "name": "VoteSubmitted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "ResultsPublished",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "title",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "description",
        "type": "string"
      },
      {
        "internalType": "string[]",
        "name": "options",
        "type": "string[]"
      },
      {
        "internalType": "uint64",
        "name": "startTime",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "endTime",
        "type": "uint64"
      }
    ],
    "name": "createPoll",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      }
    ],
    "name": "finalizePoll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      }
    ],
    "name": "getDecryptedResults",
    "outputs": [
      {
        "internalType": "uint32[]",
        "name": "",
        "type": "uint32[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      }
    ],
    "name": "getEncryptedResults",
    "outputs": [
      {
        "internalType": "euint32[]",
        "name": "",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      }
    ],
    "name": "getPoll",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      },
      {
        "internalType": "string[]",
        "name": "",
        "type": "string[]"
      },
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "",
        "type": "uint64"
      },
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "pollId",
        "type": "uint256"
      }
    ],
    "name": "getResultVerification",
    "outputs": [
      {
        "internalType": "bytes",
        "name": "encodedResults",
        "type": "bytes"
      },
      {
        "internalType": "bytes",
        "name": "proof",
        "type": "bytes"
      }
    ],
    "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "pollId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "account",
            "type": "address"
          }
        ],
        "name": "hasVoted",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "pollCount",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "pollId",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "encodedCounts",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "decryptionProof",
            "type": "bytes"
          }
        ],
        "name": "submitDecryptedResults",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "pollId",
            "type": "uint256"
          },
          {
            "internalType": "externalEuint32",
            "name": "encryptedChoice",
            "type": "bytes32"
          },
          {
            "internalType": "bytes",
            "name": "inputProof",
            "type": "bytes"
          }
        ],
        "name": "submitVote",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ] as const;
