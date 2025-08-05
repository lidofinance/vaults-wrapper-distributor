import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { IPFSService } from '../services/ipfs.js';
import { Distribution } from '../types/index.js';
import { ethers } from 'ethers';
import { DistributorAbi } from 'abi/Distributor.js';

export class ProofGenerator {
  private ipfsService: IPFSService;
  private distributorContract: ethers.Contract;
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet | null = null;

  constructor(ipfsGateway?: string, distributorAddr?: string, rpcUrl?: string, privateKey?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, this.provider);
    }

    this.ipfsService = new IPFSService(ipfsGateway);

    this.distributorContract = new ethers.Contract(
      distributorAddr || '',
      DistributorAbi,
      this.signer || this.provider
    );
  }

  async loadDistribution(): Promise<{distribution: Distribution, merkleRoot: string, cid: string}> {
    const cid = await this.distributorContract.cid();
    const merkleRoot = await this.distributorContract.root();

    console.log(`Loading distribution from IPFS CID: ${cid}`);
    
    if (!this.ipfsService.validateCID(cid)) {
      throw new Error(`Invalid CID format: ${cid}`);
    }

    const distribution = await this.ipfsService.downloadDistribution(cid);

    if (!this.validateDistribution(distribution)) {
      throw new Error('Invalid distribution format');
    }

    return {distribution, merkleRoot, cid};
  }

  generateProofForRecipient(distribution: Distribution, recipient: string): { proof: string[]; value: string[]; treeIndex: number } | null {
    const merkleTree = StandardMerkleTree.load({
      ...distribution,
      values: distribution.values.map(({ treeIndex, value }) => ({
        value,
        treeIndex: Number(treeIndex),
      })),
    });

    const recipientIndex = distribution.values.findIndex(
      value => value.value[0]?.toLowerCase() === recipient.toLowerCase()
    );
  
    if (recipientIndex === -1) {
      return null;
    }
  
    const proof = merkleTree.getProof(recipientIndex);
    const value = distribution.values[recipientIndex];
  
    return {
      proof: proof as string[],
      value: value?.value || [],
      treeIndex: recipientIndex
    };
  }

  generateProofByIndex(distribution: Distribution, index: number): { proof: string[]; value: string[]; treeIndex: number } | null {
    if (index < 0 || index >= distribution.values.length) {
      return null;
    }

    const merkleTree = StandardMerkleTree.load({
      ...distribution,
      values: distribution.values.map(({ treeIndex, value }) => ({
        value,
        treeIndex: Number(treeIndex),
      })),
    });

    const proof = merkleTree.getProof(index);
    const value = distribution.values[index];

    return {
      proof: proof as string[],
      value: value?.value || [],
      treeIndex: Number(value?.treeIndex) || 0
    };
  }

  verifyProof(value: string[], proof: string[], root: string): boolean {
    const tree = StandardMerkleTree.of([value as [string, string, string]], ['address', 'address', 'uint256']);
    return tree.verify(value as [string, string, string], proof);
  }

  getRecipientInfo(distribution: Distribution, recipient: string): { value: string[]; treeIndex: number } | null {
    const recipientIndex = distribution.values.findIndex(
      value => value.value[0]?.toLowerCase() === recipient.toLowerCase()
    );

    if (recipientIndex === -1) {
      return null;
    }

    return {
      value: distribution.values[recipientIndex]?.value || [],
      treeIndex: recipientIndex
    };
  }

  getAllRecipients(distribution: Distribution): Array<{ address: string; amount: string; treeIndex: number }> {
    return distribution.values.map((value, index) => ({
      address: value.value[0] || '',
      amount: value.value[2] || '',
      treeIndex: index
    }));
  }

  async claim(proofData: any, recipient: string, token: string, amount: string): Promise<string> {
    if (!this.distributorContract.claim) {
      throw new Error('Claim method not found on distributor contract');
    }

    console.log(`Claiming for recipient: ${recipient}`);
    console.log(`Token: ${token}`);
    console.log(`Amount: ${amount}`);
    console.log(`Proof: ${proofData.proof}`);

    try {
      const tx = await this.distributorContract.claim(
        recipient,
        token,
        amount,
        proofData.proof
      );
      
      console.log(`Claim transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Claim transaction confirmed in block: ${receipt.blockNumber}`);
      
      return tx.hash;
    } catch (error) {
      console.error('Failed to claim:', error);
      throw error;
    }
  }

  private validateDistribution(distribution: any): distribution is Distribution {
    return (
      typeof distribution === 'object' &&
      typeof distribution.prevTreeCid === 'string' &&
      Array.isArray(distribution.tree) &&
      Array.isArray(distribution.values) &&
      typeof distribution.blockNumber === 'number' &&
      typeof distribution.totalDistributed === 'object'
    );
  }
}