import { Distributor } from './index.js';
import { Claim } from '../types/index.js';

describe('Distributor', () => {
  const mockOptions = {
    rpcUrl: 'http://localhost:8545',
    wrapperAddr: '0xC1e0A9DB9eA830c52603798481045688c8AE99C2',
    tokenAddr: '0x683d9CDD3239E0e01E8dC6315fA50AD92aB71D2d',
    distributorAddr: '0x0fe4223AD99dF788A6Dcad148eB4086E6389cEB6',
    operatorFee: 0.0,
  };

  it('should create distributor instance', () => {
    const distributor = new Distributor(mockOptions);
    expect(distributor).toBeInstanceOf(Distributor);
  });

  it('should generate Merkle tree from claims', async () => {
    const distributor = new Distributor(mockOptions);
    
    const claims: Claim[] = [
      {
        recipient: '0x1234567890123456789012345678901234567890',
        token: '0x683d9CDD3239E0e01E8dC6315fA50AD92aB71D2d',
        amount: 1000000000000000000n, // 1 token
      },
      {
        recipient: '0x0987654321098765432109876543210987654321',
        token: '0x683d9CDD3239E0e01E8dC6315fA50AD92aB71D2d',
        amount: 2000000000000000000n, // 2 tokens
      },
    ];

    const result = await distributor['generateMerkleTree'](claims);
    
    expect(result.merkleRoot).toBeDefined();
    expect(result.tree).toBeDefined();
    expect(result.values).toHaveLength(2);
    expect(result.values[0].treeIndex).toBe(0);
    expect(result.values[1].treeIndex).toBe(1);
  });

  it('should hash claim correctly', async () => {
    const distributor = new Distributor(mockOptions);
    
    const claim: Claim = {
      recipient: '0x1234567890123456789012345678901234567890',
      token: '0x683d9CDD3239E0e01E8dC6315fA50AD92aB71D2d',
      amount: 1000000000000000000n,
    };

    const hash = await distributor['hashClaim'](claim);
    expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('should build Merkle tree with OpenZeppelin sorting', () => {
    const distributor = new Distributor(mockOptions);
    
    const leaves = [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000000000000000000000000000003',
    ];

    const root = distributor['buildMerkleTree'](leaves);
    expect(root).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });
}); 