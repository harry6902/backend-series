//require('dotenv').config({path:'./env'})
import dotenv from "dotenv"
import mongoose from "mongoose"
import { dbConnect } from "./db/index.js"
import { app } from "./app.js"

dotenv.config({
    path:'./.env'
})

dbConnect()
.then(()=>{
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`Server is running at : ${process.env.PORT}`)
    })
})
.catch((err)=>{
console.log("MONGO DB Connection failed !!!", err)
})

