import axios from 'axios';
import * as mongodb from 'mongodb';
import serverLog from './utils/serverLog';
import dotenv from 'dotenv';
dotenv.config();

export default class MongoHandler {
  mongoClient: mongodb.MongoClient;
  db: any;
  collection: any;

  constructor() {
    this.mongoClient = new mongodb.MongoClient(process.env.MONGO_URL || '');
  }

  async connect(): Promise<boolean> {
    try {
      await this.mongoClient.connect();
      this.db = this.mongoClient.db(process.env.DB_NAME || '');
      this.collection = this.db.collection(process.env.COLLECTION_NAME || '');
      return true;
    } catch (e) {
      serverLog(e as string);
      return false;
    }
  }

  private async updateStaticData(data) {
    await this.mongoClient.connect();
    const db = this.mongoClient.db(process.env.DB_NAME || 'GDChecker');
    const collection = db.collection(process.env.COLLECTION_NAME || 'signatures');
    await collection.insertMany(data);
    this.mongoClient.close();
  }

  async fetchData(url: string) {
    let nextUrl: string | null = url;
    let data = [];
    while (nextUrl) {
      try {
        const fetched = await axios.get(nextUrl);
        nextUrl = fetched.data?.next || null;
        const newData = fetched.data.results || [];
        data = data.concat(newData);
        console.log('records fetched:', data.length);
      } catch (e) {
        console.log('waiting 10 secs');
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
      // if (data.length > 2000) break;
    }

    return await this.updateStaticData(data);
  }
}
