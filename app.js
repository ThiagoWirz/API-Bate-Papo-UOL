import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import { MongoClient, ObjectId } from "mongodb";
import joi from "joi";
import { stripHtml } from "string-strip-html";
dotenv.config();

let dbBatePapoUOL;
const app = express();
app.use(cors());
app.use(express.json());

const participantSchema = joi.object({
  name: joi.string().required(),
});

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().required().valid("message", "private_message"),
});

const mongoClient = new MongoClient(process.env.MONGO_URI);
mongoClient.connect(() => {
  dbBatePapoUOL = mongoClient.db("bate-papo-uol");
});

setInterval(async () => {
  try {
    const participantsCollection = dbBatePapoUOL.collection("participants");
    const messagesCollection = dbBatePapoUOL.collection("messages");
    const participants = await participantsCollection.find({}).toArray();

    for (const participant of participants) {
      if (Date.now() - participant.lastStatus > 10000) {
        await participantsCollection.deleteOne({ _id: new ObjectId(participant._id) });
        await messagesCollection.insertOne({
          from: participant.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss"),
        });
      }
    }
  } catch (error) {
    console.error(error);
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

  try {
    const participantsCollection = dbBatePapoUOL.collection("participants");
    const participants = await participantsCollection.find({}).toArray();
    if (
      participants.find(
        (p) => p.name.toLowerCase() === stripHtml(req.body.name).result.trim().toLowerCase()
      )
    ) {
      res.sendStatus(409);
      return;
    }
    const messagesCollection = dbBatePapoUOL.collection("messages");
    await participantsCollection.insertOne({
      name: stripHtml(req.body.name).result.trim(),
      lastStatus: Date.now(),
    });
    await messagesCollection.insertOne({
      from: stripHtml(req.body.name).result.trim(),
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch {
    res.sendStatus(500);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participantsCollection = dbBatePapoUOL.collection("participants");
    const participantsArray = await participantsCollection.find({}).toArray();
    res.send(participantsArray);
  } catch {
    res.sendStatus(500);
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

  try {
    const messagesCollection = dbBatePapoUOL.collection("messages");
    const participantsCollection = dbBatePapoUOL.collection("participants");
    const participant = await participantsCollection.findOne({name: req.header("User")});
    if (!participant) {
      res.sendStatus(422);
      return;
    }
    await messagesCollection.insertOne({
      from: stripHtml(req.header("User")).result.trim(),
      to: stripHtml(req.body.to).result.trim(),
      text: stripHtml(req.body.text).result.trim(),
      type: stripHtml(req.body.type).result.trim(),
      time: dayjs().format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch {
    res.sendStatus(500);
  }
});

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const user = req.header("User");

  try {
    const messagesCollection = dbBatePapoUOL.collection("messages");
    const filteredMessages = await messagesCollection
      .find({ $or: [{ to: user }, { to: "Todos" }, { from: user }] })
      .toArray();
    if (!limit) {
      res.send(filteredMessages);
    } else {
      res.send(filteredMessages.slice(-limit));
    }
  } catch {
    res.sendStatus(500);
  }
});

app.post("/status", async (req, res) => {
  const user = stripHtml(req.header("User")).result.trim();

  try {
    const participantsCollection = dbBatePapoUOL.collection("participants");
    const participant = await participantsCollection.findOne({name: user});
    if (!participant) {
      res.sendStatus(404);
    } else {
      await participantsCollection.updateOne(
        { _id: new ObjectId(participant._id) },
        { $set: { lastStatus: Date.now() } }
      );
      res.sendStatus(200);
    }
  } catch {
    res.sendStatus(500);
  }
});

app.delete("/messages/:id", async (req, res) => {
  const id = req.params.id;
  const user = req.header("User");
  const messagesCollection = dbBatePapoUOL.collection("messages");
  const message = await messagesCollection.findOne({ _id: new ObjectId(id) });

  if (!message) {
    res.sendStatus(404);
    return;
  }
  if (user !== message.from || message.type === "status") {
    res.sendStatus(401);
    return;
  }
  await messagesCollection.deleteOne({ _id: new ObjectId(id) });
  res.sendStatus(200);
});

app.put("/messages/:id", async (req, res) => {
  const validation = messageSchema.validate(req.body, {
    abortEarly: true,
  });
  if (validation.error) {
    res.sendStatus(422);
    return;
  }
  const id = req.params.id;
  const user = req.header("User");
  const messagesCollection = dbBatePapoUOL.collection("messages");
  const participantsCollection = dbBatePapoUOL.collection("participants");
  const participant = await participantsCollection.findOne({ name: user });
  const message = await messagesCollection.findOne({ _id: new ObjectId(id) });

  if (!participant || !message) {
    res.sendStatus(404);
    return;
  }
  if (message.from !== user) {
    res.sendStatus(401);
    return;
  }
  await messagesCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        to: stripHtml(req.body.to).result.trim(),
        text: stripHtml(req.body.text).result.trim(),
        type: stripHtml(req.body.type).result.trim(),
        time: dayjs().format("HH:mm:ss"),
      },
    }
  );
});
app.listen(5000);
