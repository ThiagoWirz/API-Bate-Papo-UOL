import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import { MongoClient, ObjectId } from "mongodb";
import joi from "joi";
import { strict as assert } from "assert";
import { stripHtml } from "string-strip-html";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const participantSchema = joi.object({
  name: joi.string().required(),
});

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required().valid('message', 'private_message'),
});

setInterval(async () => {
  try {
    const mongoClient = new MongoClient(process.env.MONGO_URI);
    const connection = await mongoClient.connect();
    const dbBatePapoUOL = connection.db("bate-papo-uol");
    const participantsCollection = dbBatePapoUOL.collection("participants");
    const messagesCollection = dbBatePapoUOL.collection("messages");
    const participants = await participantsCollection.find({}).toArray();

    for (const participant of participants) {
      if (Date.now() - participant.lastStatus > 10000) {
        await participantsCollection.deleteOne({ name: participant.name });
        await messagesCollection.insertOne({
          from: participant.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss"),
        });
      }
    }
    connection.close();
  } catch (error) {
    console.log(error);
  }
}, 15000);

app.post("/participants", async (req, res) => {

  const validation = participantSchema.validate(req.body, {
    abortEarly: true,
  });
  if (validation.error) {
    res.sendStatus(422);
    return;
  }
  const {result} = stripHtml(req.body.name)
  const mongoClient = new MongoClient(process.env.MONGO_URI);
  const connection = await mongoClient.connect();

  try {
    const dbBatePapoUOL = connection.db("bate-papo-uol");
    const participantsCollection = dbBatePapoUOL.collection("participants");
    const participants = await participantsCollection.find({}).toArray();
    if (participants.find((p) => p.name === result)) {
      res.sendStatus(409);
      connection.close()
      return;
    }
    const messagesCollection = dbBatePapoUOL.collection("messages");
    await participantsCollection.insertOne({
      name: result,
      lastStatus: Date.now(),
    });
    await messagesCollection.insertOne({
      from: result,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
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

    const validation = messageSchema.validate(req.body, {
        abortEarly: true,
      });
      if (validation.error) {
        res.sendStatus(422);
        return;
      }

  const mongoClient = new MongoClient(process.env.MONGO_URI);
  const connection = await mongoClient.connect();
  try {
    const dbBatePapoUOL = connection.db("bate-papo-uol");
    const messagesCollection = dbBatePapoUOL.collection("messages");
    const participantsCollection = dbBatePapoUOL.collection("participants")
    const participants = await participantsCollection.find({}).toArray()
    if(!participants.find(p => p.name === req.header("User"))){
        res.sendStatus(422);
        connection.close()
        return
    }
    await messagesCollection.insertOne({
        from: req.header("User"),
        to: req.body.to,
        text: req.body.text,
        type: req.body.type,
        time: dayjs().format("HH:mm:ss")
    });
    res.sendStatus(201);
    connection.close();
  } catch {
    res.sendStatus(500);
    connection.close();
  }
});

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const user = req.header("User");
  const mongoClient = new MongoClient(process.env.MONGO_URI);
  const connection = await mongoClient.connect();

  try {
    const dbBatePapoUOL = connection.db("bate-papo-uol");
    const messagesCollection = dbBatePapoUOL.collection("messages");
    const messagesArray = await messagesCollection.find({}).toArray();
    const invertedMessages = messagesArray.reverse();
    const filteredMessages = invertedMessages.filter(
      (m) =>
        m.type !== "private_message" ||
        m.to === user ||
        m.from === user ||
        m.to === "Todos"
    );
    if (!limit) {
      res.send(filteredMessages);
      connection.close();
    } else {
      res.send(filteredMessages.slice(limit));
      connection.close();
    }
  } catch {
    res.sendStatus(500);
    connection.close();
  }
});

app.post("/status", async (req, res) => {
  const user = req.header("User");
  const mongoClient = new MongoClient(process.env.MONGO_URI);
  const connection = await mongoClient.connect();

  try {
    const dbBatePapoUOL = connection.db("bate-papo-uol");
    const participantsCollection = dbBatePapoUOL.collection("participants");
    const participantsArray = await participantsCollection.find({}).toArray();
    if (!participantsArray.find((p) => p.name === user)) {
      res.sendStatus(404);
      connection.close();
    } else {
      await participantsCollection.updateOne(
        { name: user },
        { $set: { lastStatus: Date.now() } }
      );
      res.sendStatus(200);
      connection.close();
    }
  } catch {
    res.sendStatus(500);
    connection.close();
  }
});

app.delete("/messages/:id", async (req, res) =>{
    const id = req.params.id
    const user = req.header("User")
    const mongoClient = new MongoClient(process.env.MONGO_URI);
    const connection = await mongoClient.connect();
    const dbBatePapoUOL = connection.db("bate-papo-uol");
    const messagesCollection = dbBatePapoUOL.collection("messages");
    const message = await messagesCollection.findOne({_id: new ObjectId(id)})
   
    if(!message){
        res.sendStatus(404)
        console.log("Nao achou")
        connection.close()
        return
    }
    if(user !== message.from || message.type === "status"){
        res.sendStatus(401)
        connection.close()
        return
    }
    await messagesCollection.deleteOne({_id: new ObjectId(id)})
    res.send("Mensagem removida")
    connection.close()
    
})

app.listen(4000, () => {
  console.log("Rodando em http://localhost:4000");
});
