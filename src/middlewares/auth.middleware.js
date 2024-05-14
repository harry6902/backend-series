import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model";



export const verifyJWT =asyncHandler(async(req,res,next)=>{

    const token=req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")
    if(!token){
        throw new ApiError(401,"Unauthorized request")
    }
       try {
         const decodedtoken=jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
 
         const user=await User.findById(decodedtoken?._id).select("-password -refreshToken") 
           
         if(!user){
             //NEXT VID
             throw new ApiError(401,"Invalid Access token")
 
         }
 
         req.user=user;
         next()
       } catch (error) {
            throw new ApiError(401, error?.message || "Invalid access token")

       }
       
})