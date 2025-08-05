import { create } from 'ipfs-http-client';
import { CID } from 'multiformats/cid';

export class IPFSService {
  private client: any;

  constructor(gatewayUrl: string = 'http://localhost:5001') {
    this.client = create({ url: gatewayUrl });
  }

  async uploadDistribution(distribution: any): Promise<string> {
    try {
      const data = JSON.stringify(distribution, null, 2);
      const result = await this.client.add(data);
      return result.cid.toString();
    } catch (error) {
      throw new Error(`Failed to upload to IPFS: ${error}`);
    }
  }

  async downloadDistribution(cid: string): Promise<any> {
    try {
      const chunks = [];
      for await (const chunk of this.client.cat(cid)) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks).toString();
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to download from IPFS: ${error}`);
    }
  }

  validateCID(cid: string): boolean {
    try {
      CID.parse(cid);
      return true;
    } catch {
      return false;
    }
  }
} 