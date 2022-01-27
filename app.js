import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/participants", async (req, res) => {
  const participant = { name: req.body.name, lastStatus: Date.now() };
  const logInMessage = {
    from: req.body.name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: dayjs().format("HH:mm:ss"),
  };
  const mongoClient = new MongoClient(process.env.MONGO_URI);
  const connection = await mongoClient.connect();

  try {
    const dbBatePapoUOL = connection.db("bate-papo-uol");
    const participantsCollection = dbBatePapoUOL.collection("participants");
    const messagesCollection = dbBatePapoUOL.collection("messages");
    await participantsCollection.insertOne(participant);
    await messagesCollection.insertOne(logInMessage);
    res.sendStatus(201);
    connection.close();
  } catch {
    res.sendStatus(500);
    connection.close();
  }
});

app.get("/participants", async (req, res) => {
  const mongoClient = new MongoClient(process.env.MONGO_URI);
  const connection = await mongoClient.connect();

  try {
    const dbBatePapoUOL = connection.db("bate-papo-uol");
    const participantsCollection = dbBatePapoUOL.collection("participants");
    const participantsArray = await participantsCollection.find({}).toArray();
    res.send(participantsArray);
    connection.close();
  } catch {
    res.sendStatus(500);
    connection.close();
  }
});

app.post("/messages", async (req, res) => {
  const message = {
    from: req.header("User"),
    to: req.body.to,
    text: req.body.text,
    type: req.body.type,
    time: dayjs().format("HH:mm:ss"),
  };
  const mongoClient = new MongoClient(process.env.MONGO_URI);
  const connection = await mongoClient.connect();
  try {
    const dbBatePapoUOL = connection.db("bate-papo-uol");
    const messagesCollection = dbBatePapoUOL.collection("messages");
    await messagesCollection.insertOne(message);
    res.sendStatus(201);
    connection.close();
  } catch {
    res.sendStatus(500);
    connection.close();
  }
});

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit); 
  const mongoClient = new MongoClient(process.env.MONGO_URI);
  const connection = await mongoClient.connect();
  
  try {
    const dbBatePapoUOL = connection.db("bate-papo-uol");
    const messagesCollection = dbBatePapoUOL.collection("messages");
    const messagesArray = await messagesCollection.find({}).toArray();
    if(!limit) {
      res.send(messagesArray.reverse());
      connection.close();
    } else{
        res.send(messagesArray.slice(-(limit)))
        connection.close();
    }
  } catch {
    res.sendStatus(500);
    connection.close();
  }
});

app.listen(4000, () => {
  console.log("Rodando em http://localhost:4000");
});
