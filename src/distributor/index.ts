import { ethers } from 'ethers';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { 
  DistributorOptions, 
  Distribution, 
  Claim, 
} from '../types/index.js';
import { IPFSService } from '../services/ipfs.js';
import { DistributorAbi } from '../../abi/Distributor.js';
import { WrapperAbi } from '../../abi/Wrapper.js';
import { MockERC20 } from '../../abi/MockERC20.js';
import chalk from 'chalk';

export class Distributor {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet | null = null;
  private wrapperContract: ethers.Contract;
  private distributorContract: ethers.Contract;
  private options: DistributorOptions;
  private ipfsService: IPFSService;

  constructor(options: DistributorOptions) {
    this.options = options;
    this.provider = new ethers.JsonRpcProvider(options.rpcUrl);

    if (options.privateKey) {
      this.signer = new ethers.Wallet(options.privateKey, this.provider);
    }
    
    this.wrapperContract = new ethers.Contract(
      options.wrapperAddr,
      WrapperAbi,
      this.signer || this.provider
    );
    
    this.distributorContract = new ethers.Contract(
      options.distributorAddr,
      DistributorAbi,
      this.signer || this.provider
    );

    this.ipfsService = new IPFSService(options.ipfsGateway);
  }

  async generateDistribution(): Promise<{distribution: Distribution, merkleRoot: string, cid: string}> {
    console.log('Starting distribution generation...');

    // Get previous distribution if CID provided and validate merkleRoot
    const previousInfo = await this.getPreviousDistributionInfo();
    let previousDistribution: Distribution | null = null;
    if (previousInfo) {
      try {
        previousDistribution = await this.ipfsService.downloadDistribution(previousInfo.cid);
        console.log(`Loaded previous distribution from CID: ${previousInfo.cid}`);
        
        //TODO: add IPFS hash validation too
        const isValid = await this.validatePreviousDistribution(previousDistribution, previousInfo.merkleRoot);
        if (!isValid) {
          throw new Error('Previous distribution validation failed');
        }
        console.log('Previous distribution validation passed');
      } catch (error) {
        console.error('Failed to load or validate previous distribution:', error);
        throw error;
      }
    }

    // Get last processed block
    const lastProcessedBlock = await this.distributorContract.lastProcessedBlock();
    console.log(`Last processed block: ${lastProcessedBlock.toString()}`);

    // Get current block
    const currentBlock = await this.provider.getBlockNumber();
    const currentBlockData = await this.provider.getBlock(currentBlock);
    console.log(`Current block: ${currentBlock}`);

    // Get users who made transactions since last report
    const newUsers = await this.getWrapperUsers(lastProcessedBlock, currentBlock);
    console.log(`Found ${newUsers.length} new users since last report`);

    const allUsersSet = new Set<string>();
    
    // Add users from previous distribution
    if (previousDistribution) {
      for (const value of previousDistribution.values) {
        allUsersSet.add(value.value[0]); // recipient
      }
    }
    
    // Add new users
    for (const user of newUsers) {
      allUsersSet.add(user);
    }
    
    const users = Array.from(allUsersSet);
    console.log(`Total users to process: ${users.length} (${previousDistribution ? previousDistribution.values.length : 0} from previous + ${newUsers.length} new)`);

    // Get total stvToken supply
    const totalSupply = await this.wrapperContract.totalSupply();
    console.log(`Total supply: ${totalSupply} stvToken`);

    // Create map of previous claims for cumulative calculation
    const previousClaims = new Map<string, Map<string, bigint>>();
    if (previousDistribution) {
      for (const value of previousDistribution.values) {
        const recipient = value.value[0];
        const token = value.value[1];
        const amount = BigInt(value.value[2]);
        
        if (!previousClaims.has(recipient)) {
          previousClaims.set(recipient, new Map());
        }
        previousClaims.get(recipient)!.set(token, amount);
      }
    }

    // Process each token
    const allClaims: Claim[] = [];
    const totalDistributed: { [token: string]: string } = {};

    const tokens = await this.distributorContract.getTokens();
    console.log(`Tokens: ${tokens}`);
    console.log("\n")

    for (const tokenAddr of tokens) {
      console.log(chalk.blue(`Processing token: ${tokenAddr}`));

      let tokenTotalAmount = 0n;
      if (previousDistribution) {
        tokenTotalAmount = BigInt(previousDistribution.totalDistributed[tokenAddr] || '0');
      }

      const distributableAmount = await this.calculateDistributableAmount(tokenAddr, previousDistribution);
      if (distributableAmount <= 0n) {
        console.log(`No new tokens to distribute for ${tokenAddr}`);
        totalDistributed[tokenAddr] = tokenTotalAmount.toString();
        continue;
      }

      // Calculate operator fee
      const operatorFeeAmount = (distributableAmount * BigInt(Math.floor(this.options.operatorFee * 100))) / 10000n;
      const actualDistributableAmount = distributableAmount - operatorFeeAmount;

      console.log(`Operator fee: ${operatorFeeAmount} (${this.options.operatorFee}%)`);
      console.log(`Actual distributable minus operator fee: ${actualDistributableAmount}`);

      // Calculate distribution amounts with cumulative logic
      
      const precision = BigInt(1e18);

      for (const user of users) {
        // Get user's effective balance
        const effectiveBalance = await this.wrapperContract?.balanceOf(user);
        
        if (effectiveBalance <= 0n) {
          continue;
        }

        // Calculate user's share of wrapper tokens (user_balance / total_supply)
        const userShare = (effectiveBalance * precision) / totalSupply;
        const tokenAmount = (actualDistributableAmount * userShare) / precision;

        if (tokenAmount > 0n) {
          const userPreviousClaims = previousClaims.get(user) || new Map();
          const previousAmount = userPreviousClaims.get(tokenAddr) || 0n;
          const cumulativeAmount = previousAmount + tokenAmount;

          allClaims.push({
            recipient: user,
            token: tokenAddr,
            amount: cumulativeAmount,
          });
          tokenTotalAmount = tokenTotalAmount + tokenAmount;
        }
      }
      
      totalDistributed[tokenAddr] = tokenTotalAmount.toString();
    }

    // Sort claims by address for consistent Merkle tree
    allClaims.sort((a, b) => {
      const addrCompare = a.recipient.localeCompare(b.recipient);
      if (addrCompare !== 0) return addrCompare;
      return a.token.localeCompare(b.token);
    });

    // Generate Merkle tree using OpenZeppelin
    const merkleTree = await this.generateMerkleTree(allClaims);

    const distribution: Distribution = {
        ...merkleTree.dump(),
        prevTreeCid: previousInfo?.cid || '',
        blockNumber: currentBlock,
        totalDistributed,
    };

    let cid = '';
    console.log(chalk.blue('📤 Uploading to IPFS...'));
    cid = await this.uploadToIPFS(distribution);

    return {distribution, merkleRoot: merkleTree.root, cid}
  }

  async getPreviousDistributionInfo(): Promise<{ cid: string; merkleRoot: string } | null> {
    try {
      const cid = await this.distributorContract.cid();
      const merkleRoot = await this.distributorContract.root();
      
      if (cid === '' || merkleRoot === ethers.ZeroHash) {
        return null;
      }
      
      return { cid, merkleRoot };
    } catch (error) {
      console.warn('Failed to get previous distribution info:', error);
      return null;
    }
  }

  async validatePreviousDistribution(previousDistribution: Distribution, expectedMerkleRoot: string): Promise<boolean> {
    try {
      const claims: Claim[] = previousDistribution.values.map(value => ({
        recipient: value.value[0],
        token: value.value[1],
        amount: BigInt(value.value[2])
      }));
      
      const merkleTree = await this.generateMerkleTree(claims);
      const merkleRoot = merkleTree.root;
      
      const isValid = merkleRoot === expectedMerkleRoot;

      if (!isValid) {
        console.error(`Merkle root mismatch! Expected: ${expectedMerkleRoot}, Got: ${merkleRoot}`);
      }
      
      return isValid;
    } catch (error) {
      console.error('Failed to validate previous distribution:', error);
      return false;
    }
  }

  async calculateDistributableAmount(tokenAddr: string, previousDistribution: Distribution | null): Promise<bigint> {
    const currentBalance = await this.getDistributorTokenBalance(tokenAddr);
    
    //if first distribution
    if (!previousDistribution) {
      return currentBalance;
    }
    
    // Get all Claimed events since last report
    const claimedAmount = await this.getClaimedAmountSinceLastReport(
      tokenAddr, 
      previousDistribution.blockNumber + 1, 
      'latest'
    );
    
    // Get tokens balance on distributor at the moment of previous report
    // TODO: maybe we need to store balance in the report
    const previousBalance = await this.getDistributorBalanceAtBlock(tokenAddr, previousDistribution.blockNumber);
    
    // New tokens for distribution = current balance - (previous balance - claimed)
    const newDistributableAmount = currentBalance - (previousBalance - claimedAmount);
    
    console.log(`Token ${tokenAddr}:`);
    console.log(`  Current balance: ${currentBalance}`);
    console.log(`  Previous balance: ${previousBalance}`);
    console.log(`  Claimed since last report: ${claimedAmount}`);
    console.log(`  New distributable amount: ${newDistributableAmount}`);
    
    return newDistributableAmount > 0n ? newDistributableAmount : 0n;
  }
  
  async getDistributorBalanceAtBlock(tokenAddr: string, blockNumber: number): Promise<bigint> {
    const tokenContract = new ethers.Contract(
      tokenAddr,
      MockERC20,
      this.provider
    );
    
    const balance = await tokenContract.balanceOf(this.options.distributorAddr, { blockTag: blockNumber });
    return balance || 0n;
  }

  async getClaimedAmountSinceLastReport(tokenAddr: string, fromBlock: number, toBlock: string | number): Promise<bigint> {
    const claimedTopic = ethers.id('Claimed(address,address,uint256)');
    
    const logs = await this.provider.getLogs({
      fromBlock,
      toBlock,
      address: this.options.distributorAddr,
      topics: [
        claimedTopic,
        null,
        '0x000000000000000000000000' + tokenAddr.slice(2).toLowerCase()
      ]
    });

    let totalClaimed = 0n;
    
    for (const log of logs) {
      const iface = new ethers.Interface([
        'event Claimed(address indexed recipient, address indexed token, uint256 amount)'
      ]);
      
      try {
        const parsedLog = iface.parseLog(log);
        if (parsedLog && parsedLog.args) {
          const amount = BigInt(parsedLog.args[2]);
          totalClaimed += amount;
        }
      } catch (error) {
        console.warn('Failed to parse Claimed event:', error);
      }
    }
    
    return totalClaimed;
  }

  private async generateMerkleTree(claims: Claim[]): Promise<StandardMerkleTree<[string, string, string]>> {
    if (claims.length === 0) {
      throw new Error('No claims to process');
    }

    // Format: [recipient, token, amount]
    const values: [string, string, string][] = claims.map(claim => [
      claim.recipient,
      claim.token,
      claim.amount.toString()
    ]);

    return StandardMerkleTree.of(values, ['address', 'address', 'uint256']);
  }

  async setMerkleRoot(merkleRoot: string, cid: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Private key is required to send transactions');
    }

    console.log(`Merkle Root: ${merkleRoot}`);
    console.log(`CID: ${cid}`);
  
    try {
      const tx = await this.distributorContract.setMerkleRoot(merkleRoot, cid);
      console.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
      
      return tx.hash;
    } catch (error) {
      console.error('Failed to set Merkle root:', error);
      throw error;
    }
  }

  async getDistributorTokenBalance(tokenAddr: string): Promise<bigint> {
    const tokenContract = new ethers.Contract(
      tokenAddr,
      MockERC20,
      this.provider
    );
    const balance = await tokenContract.balanceOf(this.options.distributorAddr);
    if (balance === null || balance === undefined) {
      throw new Error(`Failed to get distributor token balance for ${tokenAddr}`);
    }
    return balance;
  }

  async getWrapperUsers(fromBlock: bigint, toBlock: number): Promise<string[]> {
    const depositTopic = ethers.id('Deposit(address,address,uint256,uint256)');
    
    const logs = await this.provider.getLogs({
      fromBlock: Number(fromBlock),
      toBlock,
      address: this.options.wrapperAddr,
      topics: [depositTopic],
    });

    const addresses = new Set<string>();
    
    for (const log of logs) {
      const iface = new ethers.Interface([
        'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)'
      ]);
      
      try {
        const parsedLog = iface.parseLog(log);
        if (parsedLog && parsedLog.args) {
          addresses.add(parsedLog.args[1] as string);
        }
      } catch (error) {
        console.warn('Failed to parse event:', error);
      }
    }

    // Convert to array and filter out zero addresses
    return Array.from(addresses).filter(addr => addr !== ethers.ZeroAddress);
  }

  async uploadToIPFS(distribution: Distribution): Promise<string> {
    console.log('Uploading distribution to IPFS...');
    const cid = await this.ipfsService.uploadDistribution(distribution);
    console.log(`Distribution uploaded to IPFS with CID: ${cid}`);
    return cid;
  }

} 