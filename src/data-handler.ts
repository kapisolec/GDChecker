const getConfig = require('./utils/getConfig');
const sleep = require('./utils/sleep');

const axios = require('axios')
const fs2 = require('fs')
const mongoDB = require("mongodb")

module.exports = class DataHandler {
  readonly config: any; //TODO: types
  mongoClient: InstanceType<typeof mongoDB.MongoClient>
  constructor() {
    this.config = getConfig()
    this.mongoClient = new mongoDB.MongoClient(this.config.mongoUrl)
  }

  private async updateStaticData(data) {
    if(this.config.useMongo) {
      await this.mongoClient.connect()
      const db = this.mongoClient.db(this.config.mongoDBName)
      const collection = db.collection(this.config.mongoSignsColName)
      await collection.insertMany(data)
      this.mongoClient.close()
    }else{
      fs2.writeFileSync("./app-data/data.json", JSON.stringify(data))
    }
  }

  private async getStaticData() {
    let data
    if(this.config.useMongo) {
      await this.mongoClient.connect()
      const db = this.mongoClient.db(this.config.mongoDBName)
      const collection = db.collection(this.config.mongoSignsColName)
      data = await collection.find({}).toArray()
      this.mongoClient.close()
    }else{
      data = JSON.parse(fs2.readFileSync("./app-data/data.json"))
    }
    return data
  }

  private async fetchData(url: string, updateDB:boolean = false) {
    const config = getConfig()
  
    let nextUrl: string | null = url;
    let data = [];
    while(nextUrl) {
      try {
        const fetched = await axios.get(nextUrl);
        nextUrl = fetched.data?.next || null;
        const newData = fetched.data.results || [];
        data = data.concat(newData);
        console.log("records fetched:", data.length)
      } catch(e) {
        await sleep(30000)
      }
      // if(data.length > 2000) break; //dev
    }
  
    if(updateDB || (data && config.updateDataWhenFetch)) {
      await this.updateStaticData(data)
    }
  
    return data
  }

  public async getSignaturesData() {
    const config = getConfig()
    let data;
    if(config.fetchRecords) {
      data = await this.fetchData(config.fetchUrl);
    } else {
      data = await this.getStaticData()
    }

    return data
  }
}

