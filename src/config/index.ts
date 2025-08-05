import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { Config } from '../types/index.js';

export function loadConfig(filename: string): Config {
  try {
    const fileContents = readFileSync(filename, 'utf8');
    const config = load(fileContents) as Config;
    
    if (!config?.config) {
      throw new Error('Invalid config file structure');
    }
    
    return config;
  } catch (error) {
    throw new Error(`Failed to load config file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function getDefaultConfig(): Config {
  return {
    config: {
      rpc_url: 'http://localhost:8545',
      wrapper_addr: '',
      distributor_addr: '',
      operator_fee: 0.0,
      output_file: 'distribution.json'
    }
  };
} 