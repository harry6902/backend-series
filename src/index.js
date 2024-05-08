//require('dotenv').config({path:'./env'})
import dotenv from "dotenv"
import mongoose from "mongoose"
import { dbConnect } from "./db/index.js"

dotenv.config({
    path:'./env'
})

dbConnect()

