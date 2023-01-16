import { ethers } from "ethers"
import serverLog from "./utils/serverLog"
import MongoHandler from "./MongoHandler"

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
    bool: false,
    int256: 1
  }

  constructor(mongoHandler: MongoHandler) {
    this.provider = new ethers.providers.WebSocketProvider(process.env.PROVIDER_URL || "")
    this.mongoHandler = mongoHandler
    this.mockValues.bytes = ethers.utils.randomBytes(1);
  }

  private generateValues(inputs: ethers.utils.ParamType[]): any[] {
    let values: any[] = [];
    for (const input of inputs) {
      //console.log(input)
      let value;

      const inputTypeSimplified = input.type.replace(/\d/g, '');
      if (inputTypeSimplified === 'bytes') {
        const typeLength = /\d+/.exec(input.type) === null ? '1' : /\d+/.exec(input.type)![0]
        value = ethers.utils.randomBytes(parseInt(typeLength))
      } else {
        value = this.mockValues[inputTypeSimplified]
      }

      if (value === undefined) {
        if (input.arrayLength !== null && maxArraySize > input.arrayLength) {
          const iterations = input.arrayLength === -1 ? 1 : input.arrayLength;
          values.push([...this.generateValues(Array(iterations).fill(input.arrayChildren))])
          continue;
        }
        if (input.components !== null) {
          values.push([...this.generateValues(input.components)])
          continue;
        }
        // serverLog(`Unsupported type: ${input.type}`)
      } else {
        values.push(value)
      }
    }

    return values;
  }

  // private generateValues(inputs: ethers.utils.ParamType[]): [] {
  //   let values: string = ""
  //   const stack = [...inputs]
  //   const nestStack: number[] = []

  //   while (stack.length > 0) {
  //     if (values !== "") {
  //       values += ','
  //     }

  //     const input = stack.shift() as ethers.utils.ParamType;
  //     const inputType = input.type.replace(/\d/g, '');
  //     let value;

  //     if (inputType === 'bytes') {
  //       const typeLength = /\d+/.exec(input.type) === null ? '1' : /\d+/.exec(input.type)![0]
  //       value = ethers.utils.randomBytes(parseInt(typeLength))
  //     } else {
  //       value = this.mockValues[inputType]
  //     }

  //     if (value === undefined) {
  //       if (input.arrayLength !== null && maxArraySize > input.arrayLength) {
  //         const iterations = input.arrayLength === -1 ? 1 : input.arrayLength;
  //         nestStack.unshift(iterations)
  //         stack.unshift(...Array(iterations).fill(input.arrayChildren))
  //         continue;
  //       }
  //       if (input.components !== null) {
  //         stack.unshift(...input.components)
  //         continue;
  //       }
  //       // serverLog(`Unsupported type: ${input.type}`)
  //     } else {
  //       values += value;
  //     }
  //   }

  //   return JSON.parse(values);
  // }

  async simulateSignatures(address: string): Promise<string[]> {
    const usedFunctions: string[] = [];
    const signatureCursor = await this.mongoHandler.collection.find();

    while (await signatureCursor.hasNext()) {
      const signature = await signatureCursor.next();
      const abi = `function ${signature.text_signature}`;
      const fragment = ethers.utils.Fragment.from(abi)
      const contract = new ethers.Contract(address, [abi], this.provider)
      console.log(signature.text_signature)
      const values = this.generateValues(fragment.inputs);

      try {
        await contract.callStatic[fragment.name](...values)
        serverLog(`${signature.hex_signature} - ${signature.text_signature} found for ${address}`)
        usedFunctions.push(`${signature.hex_signature}: ${signature.text_signature}`)
      } catch (e) {
        // if ((e as any).code !== ethers.utils.Logger.errors.CALL_EXCEPTION) {
        //   console.log(signature.text_signature)
        //   console.log(values)
        //   console.log(e)
        // }
      }
    }
    return usedFunctions
  }
}
