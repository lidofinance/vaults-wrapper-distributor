import { Command } from 'commander';
import { loadConfig } from '../config/index.js';
import { Distributor } from '../distributor/index.js';
import { ProofGenerator } from '../proof-generator/index.js';
import chalk from 'chalk';
import fs from 'fs-extra';

export const program = new Command();

function convertNumberToAddress(value: any): string {
  if (typeof value === 'number') {
    return '0x' + value.toString(16).padStart(40, '0');
  }
  return value;
}

program
  .name('vaults-wrapper-distributor')
  .description('Vaults Wrapper Token Distributor')
  .version('0.0.0', '-v, --version', 'output the current version');

program
  .command('generate')
  .description('Generate Merkle tree for token distribution and upload to IPFS')
  .option('-t, --tokens <addresses>', 'Comma-separated token addresses to distribute')
  .option('-w, --wrapper <address>', 'Wrapper contract address')
  .option('-d, --distributor <address>', 'Distributor contract address')
  .option('-f, --operator-fee <number>', 'Operator fee percentage (e.g., 10.0 for 10%)', '0.0')
  .option('-r, --rpc-url <url>', 'Ethereum RPC URL', 'http://localhost:8545')
  .option('-o, --output <file>', 'Output file for distribution data', 'distribution.json')
  .option('-c, --config <file>', 'Config file path', 'config/local.yml')
  .option('-p, --prev-cid <cid>', 'Previous distribution CID for cumulative amounts')
  .option('-i, --ipfs-gateway <url>', 'IPFS gateway URL', 'http://localhost:5001')
  .option('--private-key <key>', 'Private key for transaction signing')
  .action(async (options) => {
    try {
      console.log(chalk.blue('Starting Vaults Wrapper Distributor...\n'));

      // Load config
      let config;
      try {
        config = loadConfig(options.config);
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Failed to load config from ${options.config}: ${error}`));
        console.log(chalk.blue('Using command line options only...\n'));
        config = null;
      }

      // Use config values if not provided via command line
      const wrapper = options.wrapper || convertNumberToAddress(config?.config.wrapper_addr);
      const distributor = options.distributor || convertNumberToAddress(config?.config.distributor_addr);
      const rpcUrl = options.rpcUrl !== 'http://localhost:8545' ? options.rpcUrl : (config?.config.rpc_url || options.rpcUrl);
      const operatorFee = parseFloat(options.operatorFee) || config?.config.operator_fee || 0.0;
      const outputFile = options.output !== 'distribution.json' ? options.output : (config?.config.output_file || options.output);
      const ipfsGateway = options.ipfsGateway || config?.config.ipfs_gateway || 'http://localhost:5001';
      const privateKey = options.privateKey || config?.config.private_key;

      // Validate required parameters
      if (!wrapper) {
        throw new Error('Wrapper address is required. Provide via --wrapper flag or config file.');
      }
      if (!distributor) {
        throw new Error('Distributor address is required. Provide via --distributor flag or config file.');
      }

      console.log(chalk.green('Configuration:'));
      console.log(`   Wrapper: ${chalk.cyan(wrapper)}`);
      console.log(`   Distributor: ${chalk.cyan(distributor)}`);
      console.log(`   RPC URL: ${chalk.cyan(rpcUrl)}`);
      console.log(`   Operator Fee: ${chalk.cyan(operatorFee)}%`);
      console.log(`   Output File: ${chalk.cyan(outputFile)}`);
      console.log(`   IPFS Gateway: ${chalk.cyan(ipfsGateway)}`);
      if (options.prevCid) {
        console.log(`   Previous CID: ${chalk.cyan(options.prevCid)}`);
      }
      console.log('');

      // Create distributor instance
      const distributorInstance = new Distributor({
        rpcUrl,
        wrapperAddr: wrapper,
        distributorAddr: distributor,
        operatorFee,
        ipfsGateway,
        privateKey,
      });

      console.log(chalk.blue('🔄 Generating distribution...'));
      const { distribution, merkleRoot, cid } = await distributorInstance.generateDistribution();

      if (cid) {
        console.log(chalk.blue('📤 Setting Merkle root in contract...'));
        await distributorInstance.setMerkleRoot(merkleRoot, cid);
      }

      console.log(chalk.green('\n✅ Distribution completed successfully!'));
      console.log(`    Total Users: ${chalk.cyan(distribution.values.length)}`);
      console.log(`    Merkle Root: ${chalk.cyan(merkleRoot)}`);
      console.log(`    Block Number: ${chalk.cyan(distribution.blockNumber.toString())}`);
      console.log(`    Previous Tree CID: ${chalk.cyan(distribution.prevTreeCid || 'None')}`);
      console.log(`    Total Distributed:`);
      for (const [token, amount] of Object.entries(distribution.totalDistributed)) {
        console.log(`      ${token}: ${chalk.cyan(amount)} tokens`);
      }
      if (cid) {
        console.log(`    IPFS CID: ${chalk.cyan(cid)}`);
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('proof')
  .description('Generate Merkle proofs from IPFS distribution')
  .option('-w, --wrapper <address>', 'Wrapper contract address')
  .option('-r, --rpc-url <url>', 'Ethereum RPC URL', 'http://localhost:8545')
  .option('-a, --address <address>', 'Recipient address to generate proof for')
  .option('-c, --config <file>', 'Config file path', 'config/local.yml')
  .option('-i, --index <number>', 'Index to generate proof for')
  .option('-o, --output <file>', 'Output file for proof data', 'proof.json')
  .option('--ipfs-gateway <url>', 'IPFS gateway URL', 'http://localhost:5001')
  .option('--list', 'List all recipients')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔍 Generating Merkle proofs...\n'));

      // Load config
      let config;
      try {
        config = loadConfig(options.config);
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Failed to load config from ${options.config}: ${error}`));
        console.log(chalk.blue('Using command line options only...\n'));
        config = null;
      }

      const distributor = options.distributor || convertNumberToAddress(config?.config.distributor_addr);
      const rpcUrl = options.rpcUrl !== 'http://localhost:8545' ? options.rpcUrl : (config?.config.rpc_url || options.rpcUrl);
      const ipfsGateway = options.ipfsGateway || config?.config.ipfs_gateway || 'http://localhost:5001';

      const proofGenerator = new ProofGenerator(ipfsGateway, distributor, rpcUrl);
      const { distribution, merkleRoot, cid } = await proofGenerator.loadDistribution();

      console.log(chalk.green('Distribution loaded:'));
      console.log(`    Merkle Root: ${chalk.cyan(merkleRoot)}`);
      console.log(`    Total Recipients: ${chalk.cyan(distribution.values.length)}`);
      console.log(`    Block Number: ${chalk.cyan(distribution.blockNumber.toString())}`);
      console.log(`    Previous Tree CID: ${chalk.cyan(distribution.prevTreeCid || 'None')}`);
      console.log('');

      if (options.list) {
        console.log(chalk.yellow('All recipients:'));
        const recipients = proofGenerator.getAllRecipients(distribution);
        recipients.forEach((recipient, index) => {
          console.log(`   ${index}: ${chalk.cyan(recipient.address)} - ${chalk.cyan(recipient.amount)} tokens`);
        });
        return;
      }

      let proofResult = null;
      if (options.address) {
        proofResult = proofGenerator.generateProofForRecipient(distribution, options.address);
        if (!proofResult) {
          throw new Error(`Recipient ${options.address} not found in distribution`);
        }
      } else if (options.index !== undefined) {
        const index = parseInt(options.index);
        proofResult = proofGenerator.generateProofByIndex(distribution, index);
        if (!proofResult) {
          throw new Error(`Index ${index} out of range`);
        }
      } else {
        console.log(chalk.yellow('Available recipients:'));
        const recipients = proofGenerator.getAllRecipients(distribution);
        recipients.forEach((recipient, index) => {
          console.log(`   ${index}: ${chalk.cyan(recipient.address)} - ${chalk.cyan(recipient.amount)} tokens`);
        });
        
        const prompts = await import('prompts');
        const response = await prompts.default({
          type: 'number',
          name: 'index',
          message: 'Select recipient index:',
          validate: (value: number) => value >= 0 && value < distribution.values.length ? true : 'Invalid index'
        });
        
        proofResult = proofGenerator.generateProofByIndex(distribution, response.index);
      }

      console.log(proofResult);

      if (proofResult) {
        const isValid = proofGenerator.verifyProof(
          proofResult.value,
          proofResult.proof,
          merkleRoot
        );

        const proofData = {
          recipient: proofResult.value[0],
          token: proofResult.value[1],
          amount: proofResult.value[2],
          proof: proofResult.proof,
          merkleRoot,
          treeIndex: proofResult.treeIndex,
        };

        await fs.writeJson(options.output, proofData, { spaces: 2 });

        console.log(chalk.green('\nProof generated successfully!'));
        console.log(`   File: ${chalk.cyan(options.output)}`);
        console.log(`   Recipient: ${chalk.cyan(proofResult.value[0])}`);
        console.log(`   Amount: ${chalk.cyan(proofResult.value[2])} tokens`);
        console.log(`   Proof length: ${chalk.cyan(proofResult.proof.length)} elements`);
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('claim')
  .description('Claim tokens using proof from proof.json file')
  .option('-p, --proof-file <file>', 'Proof file path', 'proof.json')
  .option('-addr, --address <address>', 'Recipient address (overrides proof file)')
  .option('-t, --token <address>', 'Token address (overrides proof file)')
  .option('-a, --amount <amount>', 'Amount to claim (overrides proof file)')
  .option('-d, --distributor <address>', 'Distributor contract address')
  .option('-r, --rpc-url <url>', 'Ethereum RPC URL', 'http://localhost:8545')
  .option('-c, --config <file>', 'Config file path', 'config/local.yml')
  .option('--private-key <key>', 'Private key for transaction signing')
  .action(async (options) => {
    try {
      console.log(chalk.blue('Claiming tokens...\n'));

      // Load config
      let config;
      try {
        config = loadConfig(options.config);
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Failed to load config from ${options.config}: ${error}`));
        console.log(chalk.blue('Using command line options only...\n'));
        config = null;
      }

      const distributor = options.distributor || convertNumberToAddress(config?.config.distributor_addr);
      const rpcUrl = options.rpcUrl !== 'http://localhost:8545' ? options.rpcUrl : (config?.config.rpc_url || options.rpcUrl);
      const privateKey = options.privateKey || config?.config.private_key;

      if (!distributor) {
        throw new Error('Distributor address is required. Provide via --distributor flag or config file.');
      }

      if (!privateKey) {
        throw new Error('Private key is required. Provide via --private-key flag or PRIVATE_KEY environment variable.');
      }

      console.log(chalk.green('Configuration:'));
      console.log(`   Distributor: ${chalk.cyan(distributor)}`);
      console.log(`   RPC URL: ${chalk.cyan(rpcUrl)}`);
      console.log(`   Proof File: ${chalk.cyan(options.proofFile)}`);
      console.log('');

      // Load proof data
      const proofData = await fs.readJson(options.proofFile);
      
      // Use command line options or fall back to proof file data
      const recipient = options.address || proofData.recipient;
      const token = options.token || proofData.token;
      const amount = options.amount || proofData.amount;

      if (!recipient || !token || !amount) {
        throw new Error('Recipient, token, and amount are required. Provide via flags or proof file.');
      }

      console.log(chalk.blue('Claim Details:'));
      console.log(`   Recipient: ${chalk.cyan(recipient)}`);
      console.log(`   Token: ${chalk.cyan(token)}`);
      console.log(`   Amount: ${chalk.cyan(amount)}`);
      console.log(`   Merkle Root: ${chalk.cyan(proofData.merkleRoot)}`);
      console.log('');

      const proofGenerator = new ProofGenerator(undefined, distributor, rpcUrl, privateKey);
      const txHash = await proofGenerator.claim(proofData, recipient, token, amount);

      console.log(chalk.green('\nClaim successful!'));
      console.log(`   Transaction Hash: ${chalk.cyan(txHash)}`);

    } catch (error) {
      console.error(chalk.red('\nError:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

export default program; 