import { ethers } from "ethers"
import serverLog from "./utils/serverLog"
import MongoHandler from "./MongoHandler"
import { throws } from "assert";
import { cursorTo } from "readline";
import { sign } from "crypto";

const maxArraySize = 100;
const blacklist = [
  'test(address[][][4][4][][][45678],uint256[][][][][][][][][][][][][][][][][][][][][][6][9])',
  'test(address[][][4][4][][][45678])'
]

export default class EthersHandler {
  provider: ethers.providers.JsonRpcProvider
  mongoHandler: MongoHandler;
  private mockValues = {
    string: "test",
    address: '0x000000000000000000000000000000000000dead',
    uint: 1,
    int: 1,
    bytes: [] as any,
    uint256: 1,
    uint128: 1,
    uint48: 1,
    uint12: 1,
    uint64: 1,
    uint32: 1,
    uint16: 1,
    uint8: 1,
    bytes32: "0x6d6168616d000000000000000000000000000000000000000000000000000000",
    bytes24: "",
    bytes4: "",
    bytes1: "",
    bool: false,
    int256: 1
  }

  constructor(mongoHandler: MongoHandler) {
    this.provider = new ethers.providers.WebSocketProvider(process.env.PROVIDER_URL || "")
    this.mongoHandler = mongoHandler
    this.mockValues.bytes = ethers.utils.randomBytes(1);
  }

  private generateValues(inputs: ethers.utils.ParamType[]): [] {
    const values: any = [];
    const stack = [...inputs]
    // console.log(inputs)
    while (stack.length > 0) {
      const input = stack.shift() as ethers.utils.ParamType;
      const inputType = input.type.replace(/\d/g, '');
      let value;

      if (inputType === 'bytes') {
        const typeLength = /\d+/.exec(input.type) === null ? '1' : /\d+/.exec(input.type)![0]
        value = ethers.utils.randomBytes(parseInt(typeLength))
      } else {
        value = this.mockValues[inputType]
      }

      if (value === undefined) {
        if (input.arrayLength !== null && maxArraySize > input.arrayLength) {
          const iterations = input.arrayLength === -1 ? 1 : input.arrayLength;
          stack.push(...Array(iterations).fill(input.arrayChildren))
          continue;
        }
        if (input.components !== null) {
          stack.push(...input.components)
          continue;
        }
        // serverLog(`Unsupported type: ${input.type}`)
      } else {
        values.push(value);
      }
    }

    // console.log(values)
    return values;
  }

  async simulateSignatures(address: string): Promise<string[]> {
    const usedFunctions: string[] = [];
    const signatureCursor = await this.mongoHandler.collection.find();

    while (await signatureCursor.hasNext()) {
      // console.time("iteration")
      const signature = await signatureCursor.next();
      const abi = `function ${signature.text_signature}`;
      const fragment = ethers.utils.Fragment.from(abi)
      const contract = new ethers.Contract(address, [abi], this.provider)
      const values = this.generateValues(fragment.inputs);

      try {
        await contract.callStatic[fragment.name](...values)
        serverLog(`${signature.hex_signature} - ${signature.text_signature} found for ${address}`)
        // console.log(values)
        usedFunctions.push(signature.text_signature)
      } catch (e) {
        if ((e as any).code === ethers.utils.Logger.errors.NETWORK_ERROR) {
          console.log(signature.text_signature)
          console.log(values)
          console.log(e)
        }
      }
      // console.timeEnd("iteration")
    }
    //   const abi = `function ${signature.text_signature}`;
    //   const fragment = ethers.utils.Fragment.from(abi)
    //   const contract = new ethers.Contract(address, [abi], this.provider)
    //   console.log(signature.text_signature)
    //   const values = this.generateValues(fragment.inputs);
    // console.log(values)
    // if (fragment.inputs.some(input => {
    //   input.baseType === 'tuple' || input.baseType === 'array'
    // })) {
    //   console.log(abi)
    //   console.log(values)
    // }

    //   continue;
    //   try {
    // await contract.callStatic[fragment.name](...values)
    //     serverLog(`${signature.hex_signature} - ${signature.text_signature} found for ${address}`)
    //     usedFunctions.push(signature.text_signature)
    //   } catch (e) {
    //     if ((e as any).code !== ethers.utils.Logger.errors.NETWORK_ERROR) {
    //       console.log(signature.text_signature)
    //       console.log(result)
    //       console.log(e)
    //     }
    //     continue
    //   }
    // }
    return usedFunctions
  }
}
