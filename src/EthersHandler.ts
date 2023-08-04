import { ethers } from 'ethers';
import serverLog from './utils/serverLog';
import MongoHandler from './MongoHandler';
import { disassemble } from '@ethersproject/asm';
import { blockchains } from './utils/getConfig';
import { ObjectId } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const maxArraySize = 100;

export interface SignatureObject {
  _id: ObjectId;
  hex_signature: string;
  text_signature: string;
  id: number;
  bytes_signature: string;
  created_at: string;
}

export default class EthersHandler {
  provider: ethers.providers.JsonRpcProvider;
  mongoHandler: MongoHandler;
  simulationWallet: ethers.Wallet;

  private mockValues = {
    string: 'test',
    address: '0x57EC39B5dd050c55d8E5A0D607d07563631Bf33b',
    uint: 0,
    int: 0,
    bytes: [] as any,
    bool: false,
  };

  constructor(mongoHandler: MongoHandler) {
    this.provider = new ethers.providers.WebSocketProvider(process.env.PROVIDER_URL || '');
    this.mongoHandler = mongoHandler;
    this.simulationWallet = new ethers.Wallet(process.env.DECOMPILER_PRIVATE_KEY || '', this.provider);
  }

  private generateValues(inputs: ethers.utils.ParamType[]): any[] {
    let values: any[] = [];
    for (const input of inputs) {
      let value;

      const inputTypeSimplified = input.type.replace(/\d/g, '');
      if (inputTypeSimplified === 'bytes') {
        const typeLength = /\d+/.exec(input.type) === null ? '1' : /\d+/.exec(input.type)![0];
        value = ethers.utils.randomBytes(parseInt(typeLength));
      } else {
        value = this.mockValues[inputTypeSimplified];
      }

      if (value === undefined) {
        if (input.arrayLength !== null && maxArraySize > input.arrayLength) {
          const iterations = input.arrayLength === -1 ? 1 : input.arrayLength;
          values.push([...this.generateValues(Array(iterations).fill(input.arrayChildren))]);
          continue;
        }
        if (input.components !== null) {
          values.push([...this.generateValues(input.components)]);
          continue;
        }
        serverLog(`Unsupported type: ${input.type}`);
      } else {
        values.push(value);
      }
    }

    return values;
  }

  async getCodeForChain(tokenAddress: string): Promise<string> {
    for await (const nodeAddress of Object.values(blockchains)) {
      console.log(nodeAddress)
      let provider: ethers.providers.Provider;
      if (nodeAddress.includes('ws')) {
        provider = new ethers.providers.WebSocketProvider(nodeAddress);
      } else {
        provider = new ethers.providers.JsonRpcProvider(nodeAddress);
      }
      const code = await provider.getCode(tokenAddress);
      console.log(code)
      if (code !== '0x') {
        return code;
      }
    }
    return 'Unsupported Chain';
  }

  async getFunctionSignatures(address: string) {
    const code = await this.getCodeForChain(address);
    if (code != 'Unsupported Chain') {
      const ids = [
        ...new Set(
          disassemble(code)
            .filter((obj) => obj.opcode.mnemonic === 'PUSH4')
            .map((obj) => obj.pushValue)
        ),
      ];
      console.log(ids)
      return ids;
    } else {
      return [];
    }
  }

  async simulateSignature(address: string, signature: string): Promise<boolean> {
    const abi = `function ${signature}`;
    const fragment = ethers.utils.Fragment.from(abi);
    const contract = new ethers.Contract(address, [abi], this.provider);
    const values = this.generateValues(fragment.inputs);

    try {
      await contract.callStatic[fragment.name](...values);
      serverLog(`Found ${signature} for ${address}`);
      return true;
    } catch (e) {
      return false;
    }
  }

  async simulateSignatures(address: string): Promise<string[]> {
    const usedFunctions: string[] = [];
    const signatureCursor = await this.mongoHandler.collection.find();
    let queries: any = [];
    const querySize = 50;

    while (await signatureCursor.hasNext()) {
      const signature = await signatureCursor.next();
      const abi = `function ${signature.text_signature}`;
      const fragment = ethers.utils.Fragment.from(abi);
      const contract = new ethers.Contract(address, [abi], this.provider);
      const values = this.generateValues(fragment.inputs);

      queries.push(
        new Promise(async (resolve) => {
          try {
            await contract.callStatic[fragment.name](...values);
            usedFunctions.push(`${signature.hex_signature}: ${signature.text_signature}`);
            serverLog(`Found ${signature.hex_signature} - ${signature.text_signature} for ${address}`);
          } catch (e) { }
          resolve(true);
        })
      );

      if (queries.length === querySize) {
        await Promise.allSettled(queries);
        queries = [];
      }
    }

    await Promise.allSettled(queries);

    return usedFunctions;
  }

  async simulateFees(address: string, signatures: SignatureObject[]): Promise<Record<string, number>> {
    const fees: Record<string, number> = {};
    console.log(this.simulationWallet.address);
    for await (const signature of signatures) {
      try {
        console.log({ function: signature.text_signature });
        const abi = `function ${signature.text_signature} public view`;
        const fragment = ethers.utils.Fragment.from(abi);
        const contract = new ethers.Contract(address, [abi], this.simulationWallet);

        const values = await contract[fragment.name]();
        console.log(values);
      } catch (error) {
        console.log(error);
      }
    }

    return fees;
  }
}
