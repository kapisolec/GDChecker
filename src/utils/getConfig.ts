import fs from 'fs';

export function getConfig() {
  return JSON.parse(fs.readFileSync('./app-config.json').toString());
}

export const blockchains = {
  eth: 'ws://23.88.66.251:8550',
  bsc: 'ws://148.251.78.120:8648/c9da2a709c34cc1708b9f82e5d7b8d00',
  arbitrum: 'http://23.88.66.251:8547',
  zksync: 'https://mainnet.era.zksync.io',
  goerli: "https://rpc.ankr.com/eth_goerli",
  base: "https://developer-access-mainnet.base.org"
};
