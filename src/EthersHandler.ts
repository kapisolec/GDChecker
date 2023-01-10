import ethers from "ethers"

export default class EthersHandler {
  provider: ethers.providers.JsonRpcProvider
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL)
  }

  public parseTextSignature(textSignature) {
    let functionName = '';
    const functionArguments: string[] = []

    const functionArgumentTypes: string[] = []

    const argumentOptions = {
      string: "test",
      address: process.env.WALLET,
      "uint256[]": [1, 2, 3],
      "uint256[2]": [1, 2],
      uint256: 1,
      uint64: 1,
      bytes32: "34523452345246",
      bool: false,
      int256: 1
    }

    let currentArgument = ''
    let argumentsStarted = false
    for (const itr of textSignature) {
      if (itr === " " || itr === ".") continue;
      if (itr === "(") {
        argumentsStarted = true;
        continue
      }
      if (itr === ")") {
        functionArgumentTypes.push(currentArgument)
        functionArguments.push(argumentOptions[currentArgument])
        break;
      }

      if (argumentsStarted) {
        if (itr === ",") {
          functionArgumentTypes.push(currentArgument)
          functionArguments.push(argumentOptions[currentArgument])
          currentArgument = ""
          continue
        }
        currentArgument += itr
        continue
      }
      functionName += itr
    }
    const ERC20_ABI = `function ${functionName}(${functionArgumentTypes.reduce((prev, cur) => {
      return prev === "" ? cur : prev + "," + cur
    }, "")})`
    return {
      functionName,
      functionArguments,
      ERC20_ABI
    }
  }

  async simulateSignatures(address: string, signatures): Promise<string[]> {
    const usedFunctions: string[] = [];

    for (const signature of signatures) {
      const { functionName, functionArguments, ERC20_ABI } = this.parseTextSignature(signature.text_signature)
      const contract = new ethers.Contract(address, [
        ERC20_ABI
      ], this.provider)
      try {
        await contract.callStatic[functionName](...functionArguments)
        usedFunctions.push(functionName)
      } catch (e) {
        continue
      }
    }
    return usedFunctions
  }
}
