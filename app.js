import express from "express"
import cors from "cors"
import dotenv from "dotenv"

const app = express()
app.use(cors())
app.use(express.json())

app.listen(4000, () => {
    console.log("Rodando em http://localhost:4000")
})