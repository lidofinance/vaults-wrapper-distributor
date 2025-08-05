cumulative rewards distributor

for testing:

### Vaults-wrapper repository
#### terminal1
```bash
make start-fork
```

#### terminal2
```bash
make mock-deploy
```

this will deploy contracts and make test deposits, and also put contract addresses in artifacts/deploy-local.json

extract from there:
 - distributor
 - wrapper

### Vaults-wrapper-distributor repository
add contract addresses to config config/local.yml

#### terminal 3
```bash
yarn start generate --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

private key is specified for anvil user(0)
this command will generate merkleTree, save it to ipfs, and send a new merkleRoot from user(0) to Distributor

format:
```json
{
  "format": "standard-v1",
  "leafEncoding": [
    "address",
    "address",
    "uint256"
  ],
  "tree": [
    "0x745c201f6386b35c78db3fd7c5d6560b65d423b0b43bac0ecbdca33210c2ed9a",
    "0x9c6f6ab600b3b80aae0b8ab69b77b3787c6e70935e8dd8a9f09703c3349de858",
    ...
  ],
  "values": [
    {
      "value": [
        "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
        "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
        "631643291598885354"
      ],
      "treeIndex": 22
    }
  ],
  "prevTreeCid": "",
  "blockNumber": 17,
  "totalDistributed": {
    "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9": "1999999999999999992",
    "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707": "2999999999999999988"
  }
}
```


For proof generation
```bash
yarn start proof -i 0
```

this will generate a `proof.json` file

For claiming
```bash
yarn start claim --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

This command will take `proof.json` and send a `claim()` transaction to Distributor
