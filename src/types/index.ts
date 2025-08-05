export interface Config {
  config: {
    rpc_url: string;
    wrapper_addr: string;
    token_addr: string[];
    distributor_addr: string;
    operator_fee: number;
    output_file: string;
    ipfs_gateway?: string;
  };
}


export interface Claim {
  recipient: string;
  token: string;
  amount: bigint;
}

export interface Distribution {
  format: 'standard-v1';
  leafEncoding: ['address', 'address', 'uint256'];
  tree: string[];
  values: {
    treeIndex: bigint;
    value: [string, string, string];
  }[];
  prevTreeCid: string;
  blockNumber: number;
  totalDistributed: { [token: string]: string };
}

export interface DistributorOptions {
  rpcUrl: string;
  wrapperAddr: string;
  distributorAddr: string;
  operatorFee: number;
  ipfsGateway?: string;
  privateKey?: string;
}
