import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


setInterval( async () => {
    try{
    const mongoClient = new MongoClient(process.env.MONGO_URI)
    const connection = await mongoClient.connect()
    const dbBatePapoUOL = connection.db("bate-papo-uol");
    const participantsCollection = dbBatePapoUOL.collection("participants");
    const messagesCollection = dbBatePapoUOL.collection("messages");
    const participants = await participantsCollection.find({}).toArray()

    for(const participant of participants){
        if(Date.now() - participant.lastStatus > 10000 ){
            await participantsCollection.deleteOne({name: participant.name})
            await messagesCollection.insertOne({ 
            from: participant.name,
            to: "Todos",
            text: "sai da sala...",
            type: "status",
            time: dayjs().format("HH:mm:ss"),
            })
        }
    }
    connection.close()}
    catch (error){
        console.log(error)
    }
}, 15000)

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
  const user = req.header("User")
  const mongoClient = new MongoClient(process.env.MONGO_URI);
  const connection = await mongoClient.connect();
  
  try {
    const dbBatePapoUOL = connection.db("bate-papo-uol");
    const messagesCollection = dbBatePapoUOL.collection("messages");
    const messagesArray = await messagesCollection.find({}).toArray();
    const invertedMessages = messagesArray.reverse()
    const filteredMessages = invertedMessages.filter( m => (m.type !== "private_message") || (m.to === user || m.from === user || m.to === "Todos"))
    if(!limit) {
      res.send(filteredMessages);
      connection.close();
    } else{
        res.send(filteredMessages.slice(limit))
        connection.close();
    }
  } catch {
    res.sendStatus(500);
    connection.close();
  }
});

app.post("/status", async (req, res) =>{
    const user = req.header("User")
    const mongoClient = new MongoClient(process.env.MONGO_URI);
    const connection = await mongoClient.connect()

    try{
        const dbBatePapoUOL = connection.db("bate-papo-uol")
        const participantsCollection = dbBatePapoUOL.collection("participants")
        const participantsArray = await participantsCollection.find({}).toArray()
        if(!participantsArray.find( p => p.name === user)){
            res.sendStatus(404);
            connection.close()
        }
        else{
           await participantsCollection.updateOne({name: user}, {$set: {lastStatus: Date.now()}})
            res.sendStatus(200)
            connection.close()
        }
    }
    catch{
        res.sendStatus(500);
        connection.close();
    }
})

app.listen(4000, () => {
  console.log("Rodando em http://localhost:4000");
});
