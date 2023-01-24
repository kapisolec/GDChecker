import * as mongodb from "mongodb";
import serverLog from "./utils/serverLog"

export default class MongoHandler {
  mongoClient: mongodb.MongoClient;
  db: any;
  collection: any;

  constructor() {
    this.mongoClient = new mongodb.MongoClient(process.env.MONGO_URL || "")
  }

  async connect(): Promise<boolean> {
    try {
      await this.mongoClient.connect();
      this.db = this.mongoClient.db(process.env.DB_NAME || "");
      this.collection = this.db.collection(process.env.COLLECTION_NAME || "")
      return true;
    } catch (e) {
      serverLog(e as string);
      return false;
    }
  }
}
