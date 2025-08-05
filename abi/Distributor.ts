export const DistributorAbi = [
    {
        "type": "constructor",
        "inputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "addToken",
        "inputs": [
            {
                "name": "token",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "cid",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "string",
                "internalType": "string"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "claim",
        "inputs": [
            {
                "name": "_recipient",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "_token",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "_amount",
                "type": "uint256",
                "internalType": "uint256"
            },
            {
                "name": "_proof",
                "type": "bytes32[]",
                "internalType": "bytes32[]"
            }
        ],
        "outputs": [
            {
                "name": "amount",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "claimable",
        "inputs": [
            {
                "name": "token",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "amount",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "claimed",
        "inputs": [
            {
                "name": "account",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "token",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "amount",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getTokens",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "address[]",
                "internalType": "address[]"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "lastProcessedBlock",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint256",
                "internalType": "uint256"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "root",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "setMerkleRoot",
        "inputs": [
            {
                "name": "_root",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "_cid",
                "type": "string",
                "internalType": "string"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "Claimed",
        "inputs": [
            {
                "name": "recipient",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "token",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "amount",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "MerkleRootUpdated",
        "inputs": [
            {
                "name": "oldRoot",
                "type": "bytes32",
                "indexed": false,
                "internalType": "bytes32"
            },
            {
                "name": "newRoot",
                "type": "bytes32",
                "indexed": false,
                "internalType": "bytes32"
            },
            {
                "name": "oldCid",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "newCid",
                "type": "string",
                "indexed": false,
                "internalType": "string"
            },
            {
                "name": "oldBlock",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            },
            {
                "name": "newBlock",
                "type": "uint256",
                "indexed": false,
                "internalType": "uint256"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "TokenAdded",
        "inputs": [
            {
                "name": "token",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "AlreadyProcessed",
        "inputs": []
    },
    {
        "type": "error",
        "name": "ClaimableTooLow",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidProof",
        "inputs": []
    },
    {
        "type": "error",
        "name": "RootNotSet",
        "inputs": []
    },
    {
        "type": "error",
        "name": "SafeERC20FailedOperation",
        "inputs": [
            {
                "name": "token",
                "type": "address",
                "internalType": "address"
            }
        ]
    }
]