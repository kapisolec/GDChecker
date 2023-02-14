const getConfig2 = require('./utils/getConfig');

const ethers = require('ethers');

module.exports = class EthersHandler {
  readonly config: any; //TODO: types
  provider: InstanceType<typeof ethers.providers.JsonRpcProvider>;
  constructor() {
    this.config = getConfig2();
    this.provider = new ethers.providers.JsonRpcProvider(this.config.ethersProviderUrl);
  }

  public parseTextSignature(textSignature) {
    let functionName = '';
    const functionArguments: string[] = [];

    const functionArgumentTypes: string[] = [];

    const argumentOptions = {
      string: 'test',
      address: this.config.testWallet,
      'uint256[]': [1, 2, 3],
      'uint256[2]': [1, 2],
      uint256: 1,
      uint64: 1,
      bytes32: '34523452345246',
      bool: false,
      int256: 1
    };

    let currentArgument = '';
    let argumentsStarted = false;
    for (const itr of textSignature) {
      if (itr === ' ' || itr === '.') continue;
      if (itr === '(') {
        argumentsStarted = true;
        continue;
      }
      if (itr === ')') {
        functionArgumentTypes.push(currentArgument);
        functionArguments.push(argumentOptions[currentArgument]);
        break;
      }

      if (argumentsStarted) {
        if (itr === ',') {
          functionArgumentTypes.push(currentArgument);
          functionArguments.push(argumentOptions[currentArgument]);
          currentArgument = '';
          continue;
        }
        currentArgument += itr;
        continue;
      }
      functionName += itr;
    }
    const ERC20_ABI = `function ${functionName}(${functionArgumentTypes.reduce((prev, cur) => {
      return prev === '' ? cur : prev + ',' + cur;
    }, '')})`;
    return {
      functionName,
      functionArguments,
      ERC20_ABI
    };
  }

  public async getUsedSignatures(contractAddress: string, signaturesData: Record<string, any>[]) {
    const usedFunctions: string[] = [];
    for (const item of signaturesData) {
      const { functionName, functionArguments, ERC20_ABI } = this.parseTextSignature(item.text_signature);
      const contract = new ethers.Contract(contractAddress, [ERC20_ABI], this.provider);
      try {
        await contract.callStatic[functionName](...functionArguments);
      } catch (e) {
        continue;
      }
      usedFunctions.push(functionName);
    }
    return usedFunctions;
  }
};
