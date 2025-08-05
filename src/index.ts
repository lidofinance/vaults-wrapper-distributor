#! /usr/bin/env node

import { program } from './command/index.js';

program.parseAsync(process.argv).catch((error) => {
  console.error('CLI Error:', error.message);
  process.exit(1);
}); 