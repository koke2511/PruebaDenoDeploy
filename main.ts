import { ApolloServer } from "@apollo/server";
import { MongoClient, Collection } from "mongodb";
import { ContactoModel } from "./types.ts";
import {startStandaloneServer } from "@apollo/server/standalone";
import { resolvers } from "./resolvers.ts";
import { schema } from "./schema.ts";

const MONGO_URL = "mongodb+srv://db_username:db_password@cluster-video.zxbq7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster-Video";

if(!MONGO_URL) {
  throw new Error("Please provide a MONGO_URL");
}

const mongoClient = new MongoClient(MONGO_URL);
await mongoClient.connect();

console.info("Connected to MongoDB");

const mongoDB = mongoClient.db("agenda");
const ContactoCollection = mongoDB.collection<ContactoModel> ("contactos");

const server = new ApolloServer({
  typeDefs: schema, 
  resolvers,
});

const { url } = await startStandaloneServer(server, {
  context: async() => ({ContactoCollection}),
});

console.info(`Server ready at ${url}`);
