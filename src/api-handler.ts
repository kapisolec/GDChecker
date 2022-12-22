const getConfig3 = require('./utils/getConfig')
const DataHandler = require ('./data-handler');
const EthersHandler = require('./ethers-handler');

const express = require('express')

module.exports = class ApiHandler {
  private dataHandler: InstanceType<typeof DataHandler>
  private ethersHandler: InstanceType<typeof EthersHandler>
  private expressApp: ReturnType<typeof express>
  private config: any //TODO: types
  constructor() {
    this.expressApp = express()
    this.config = getConfig3()
    this.dataHandler = new DataHandler()
    this.ethersHandler = new EthersHandler()
  }

  public async configureApp() {
    if (this.config.fetchRecordsWhenRun) {
      await this.dataHandler.fetchData(this.config.fetchUrl, true)
    }
    this.expressApp.get('/',(_,res)=>{
      res.send("<h1>chuj</h1>")
    })
    this.expressApp.get('/checker-api', async (req, res)=> {
      const data = await this.dataHandler.getSignaturesData()
      const id = req.query.contractId;
      console.log(req.query);
      console.log("id",id);
      const result = await this.ethersHandler.getUsedSignatures(id, data)
      res.send(result)
    })
  }

  public listen() {
    this.expressApp.listen(this.config.expressPort, (()=>{
      console.log(`App listens on port ${this.config.expressPort}`)
    }).bind(this))
  }
}
