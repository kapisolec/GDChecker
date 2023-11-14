import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import MongoHandler from './MongoHandler';
import EthersHandler from './EthersHandler';
import serverLog from './utils/serverLog';
import { ethers } from 'ethers';

dotenv.config();

const app = express();
const port = process.env.API_PORT;
const mongoHandler = new MongoHandler();
const ethersHandler = new EthersHandler(mongoHandler);

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept', 'Access-Control-Allow-Origin'],
  })
);

app.get('/:id', async (req, res) => {
  const id = req.params.id;
  serverLog(`Decompiling ${id}...`);
  if (!ethers.utils.isAddress(id)) {
    return res.status(404).send('Invalid query string parameter id');
  }
  const functionSignatures = await ethersHandler.getFunctionSignatures(id);

  const checksum = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(functionSignatures.join(''))).slice(0, 18);
  console.log({ checksum })
  const functionSignaturesData = functionSignatures.map(async (id) => {
    return await mongoHandler.collection
      .find({
        hex_signature: id,
      })
      .toArray();
  });

  const uniqueSignatures = (await Promise.allSettled(functionSignaturesData))
    .map((promise) => (promise as any).value)
    .map((values) => {
      if (values.length > 1) {
        const minId = Math.min(...values.map((value) => value.id));
        return values.find((value) => value.id === minId);
      }
      return values[0];
    })
    .filter((value) => value !== undefined);

  const allFunctions = {};
  uniqueSignatures.forEach((sig) => {
    allFunctions[sig.hex_signature] = sig.text_signature;
  });

  const possiblyLaunchFunctions = uniqueSignatures.filter((id: Record<string, string>) => {
    const fncName = id.text_signature;
    if (/launch|start|enable|trading|open|activate|start|begin/gim.test(fncName)) {
      return true;
    }
  });

  const possiblyFeeFunctions = uniqueSignatures.filter((id: Record<string, string>) => {
    const fncName = id.text_signature;
    // create regex that matches empty parentheses
    // create regex with /fee|tax/ and make it check if there isn't anything between parentheses
    if (/(fee|tax)[a-z]*\(\)/gim.test(fncName)) {
      return true;
    }
  });


  // filter out the functions that are not in the uniqueSignatures array
  const unknownFunctions = functionSignatures.filter((id) => !uniqueSignatures.find((sig) => sig.hex_signature === id));

  // todo
  // const fees = await ethersHandler.simulateFees(id, possiblyFeeFunctions);

  // console.log(possiblyFeeFunctions);

  const results = {
    possiblyLaunchFunctions,
    possiblyFeeFunctions,
    // fees,
    uniqueSignatures,
    checksum,
    unknownFunctions
  };

  serverLog(`${id} decompiled.`);
  res.send(results);
});

app.get('/checker-api', async (req, res) => {
  const address = req.query.address;
  if (typeof address !== 'string') {
    serverLog('Invalid query string parameter: addresss');
    res.status(404).send('Invalid query string parameter: addresss');
  }
  serverLog(`Request received: ${address}`);

  console.time(`Decompiled ${address}`);
  res.status(200).send(await ethersHandler.simulateSignatures(address as string));
  console.timeEnd(`Decompiled ${address}`);
});

app.get('/get-method/:method', async (req, res) => {
  const id = req.params.method;
  // console.log(req.query)
  if (typeof id !== 'string') {
    serverLog('Invalid query string parameter: method_id');
    res.status(404).send('Invalid query string parameter: addresss');
  }
  try {
    res.send(
      await mongoHandler.collection
        .find({
          hex_signature: id,
        })
        .toArray()
    );
  } catch (e) {
    serverLog(e as string);
    res.status(500).send();
  }
});

async function run() {
  if (!(await mongoHandler.connect())) {
    process.exit();
  }
  app.listen(port, async () => {
    serverLog('Server listening on port ' + port);
  });
}

run();
