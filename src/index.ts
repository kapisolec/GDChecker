import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import MongoHandler from "./MongoHandler"
import EthersHandler from "./EthersHandler"
import serverLog from "./utils/serverLog";

dotenv.config()

const app = express()
const port = process.env.API_PORT;
const mongoHandler = new MongoHandler();
const ethersHandler = new EthersHandler();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Origin',
    'X-Requested-With',
    'Accept',
    'Access-Control-Allow-Origin',
  ],
}))

app.get('/', (req, res) => {
  res.send("test");
})

app.get('/checker-api', async (req, res) => {
  const address = req.query.address;
  if (typeof address !== 'string') {
    serverLog('Invalid query string parameter: addresss');
    res.status(404).send('Invalid query string parameter: addresss')
  }
  serverLog(`Request received: ${address}`)

  console.time('Signatures fetched')
  const signatures = await mongoHandler.collection.find().toArray();
  console.timeEnd('Signatures fetched')

  res.status(200).send(await ethersHandler.simulateSignatures(address, signatures))
})

async function run() {
  if (!await mongoHandler.connect()) {
    process.exit();
  }
}

app.listen(port, async () => {
  console.log("Server listening on port " + port)
})

run();
