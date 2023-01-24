import { ethers } from "ethers"
import serverLog from "./utils/serverLog"
import MongoHandler from "./MongoHandler"
import { disassemble } from '@ethersproject/asm';

const maxArraySize = 100;
const toTest = ['0x6e4ee811', '0x2e5b4c43', '0x9dc29fac', '0xa6f9dae1', '0xa9059cbb', '0x23b872dd', '0x269e197f', '0x2f878588', '0x33cd5ebd']
export default class EthersHandler {
  provider: ethers.providers.JsonRpcProvider
  mongoHandler: MongoHandler;
  private mockValues = {
    string: "test",
    address: '0x57EC39B5dd050c55d8E5A0D607d07563631Bf33b',
    uint: 0,
    int: 0,
    bytes: [] as any,
    bool: false,
  }

  constructor(mongoHandler: MongoHandler) {
    this.provider = new ethers.providers.WebSocketProvider(process.env.PROVIDER_URL || "")
    this.mongoHandler = mongoHandler
  }

  private generateValues(inputs: ethers.utils.ParamType[]): any[] {
    let values: any[] = [];
    for (const input of inputs) {
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
        serverLog(`Unsupported type: ${input.type}`)
      } else {
        values.push(value)
      }
    }

    return values;
  }

  async getFunctionSignatures(address: string) {
    const code = await this.provider.getCode(address);
    const ids = [
      ...new Set(
        disassemble(code)
          .filter((obj) => obj.opcode.mnemonic === 'PUSH4')
          .map((obj) => obj.pushValue)
      ),
    ];

    return ids;
  }

  async simulateSignature(address: string, signature: string): Promise<boolean> {
    const abi = `function ${signature}`;
    const fragment = ethers.utils.Fragment.from(abi)
    const contract = new ethers.Contract(address, [abi], this.provider)
    const values = this.generateValues(fragment.inputs);

    try {
      const result = await contract.callStatic[fragment.name](...values)
      serverLog(`Found ${signature} for ${address}`)
      return true;
    } catch (e) {
      return false;
    }
  }

  async simulateSignatures(address: string): Promise<string[]> {
    const usedFunctions: string[] = [];
    const signatureCursor = await this.mongoHandler.collection.find();
    let queries: any = []
    const querySize = 50;

    while (await signatureCursor.hasNext()) {
      const signature = await signatureCursor.next();
      const abi = `function ${signature.text_signature}`;
      const fragment = ethers.utils.Fragment.from(abi)
      const contract = new ethers.Contract(address, [abi], this.provider)
      const values = this.generateValues(fragment.inputs);

      queries.push(new Promise(async (resolve, rejection) => {
        try {
          await contract.callStatic[fragment.name](...values)
          usedFunctions.push(`${signature.hex_signature}: ${signature.text_signature}`)
          serverLog(`Found ${signature.hex_signature} - ${signature.text_signature} for ${address}`)
        } catch (e) {
        }
        resolve()
      }))

      if (queries.length === querySize) {
        await Promise.allSettled(queries)
        queries = []
      }
    }

    await Promise.allSettled(queries)

    return usedFunctions
  }
}
