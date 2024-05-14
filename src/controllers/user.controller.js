import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError}  from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"


const generateAccessAndRefreshTokens = async(userId)=>{

    try {
        const user=await User.findById(userId);
        const accessToken= user.generateAccessToken()
        const refreshToken= user.generateRefreshToken()
        
        user.refreshToken=refreshToken;
        await user.save({validateBeforeSave:false})

        return {accessToken,refreshToken};

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating Access and Refresh Token")
    }

}

const registerUser = asyncHandler( async(req,res)=>{
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const { username,fullName,password, email}= req.body;
    
    if(
        [username,fullName,email,password].some((field)=>{
            field?.trim===""
        })
    ){
        throw new ApiError(400, "Mandate fields shouldn't be empty")
    }


    const existingUser= await User.findOne({
        $or:[{ username },{ email }]
    })
    if(existingUser){
        throw new ApiError(409, "User already exists with same email or username");
    }

    const avatarLocalPath=req.files?.avatar[0]?.path;
    // const coverImageLocalPath=req.files?.coverImage[0]?.path;
    let coverImageLocalPath;

    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath=req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is requied")
    }
    const avatar=await uploadOnCloudinary(avatarLocalPath)
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")

    }

   const user= await User.create({
        fullName,
        avatar:avatar.url,
        coverImage: coverImage?.url || "",
        username,
        password,
        email
    })

    const createdUser= await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser){
        throw new ApiError(500,"Something went wrong in registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered succesfully")
    )

})

const loginUser= asyncHandler( async(req,res)=>{
  // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie

    const {username,email,password} = req.body

    if(!(username || password) ){
        throw new ApiError(400,"username or email is required")

    }

   const user=await User.findOne({
        $or:[ { username },{ email }]
    })

    if(!user){
        throw new ApiError(404,"User doesnot exist")

    }

    const isPasswordValid=await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid User credentials")

    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options={
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {user:loggedInUser,accessToken,refreshToken},
            "User LoggedIn successfully"
    )
    )
})


const logOutUser= asyncHandler(async (req,res)=>{


    await User.findByIdAndUpdate(req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        }
    )

    const options= {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(
            200,
            {},
            "User logged out successfully"
        )
    )
})

const refreshAccessToken =asyncHandler( async (req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized refresh token")
    }

   try {
     const decodedToken= jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
 
     const user=await User.findById(decodedToken?._id)
 
     if(!user){
         throw new ApiError(401,"Invalid refresh Token")
     }
     if(incomingRefreshToken !== user?.refreshToken){
         throw new ApiError(401,"Refresh token is expired or used")
     }
 
     const options={
         httpOnly:true,
         secure:true
     }
     const {accessToken,newRefreshToken}=await generateAccessAndRefreshTokens(user._id);
 
     return res
     .status(200)
     .cookie("accessToken",accessToken,options)
     .cookie("refreshToken",newRefreshToken,options)
     .json(
         new ApiResponse(
             200,
             {accessToken,refreshToken:newRefreshToken},
             "access token refreshed"
         )
     )
   } catch (error) {
       throw new ApiError(401, error?.message || "Invalid Refresh Token")
   }
})

const changeCurrentPassword = asyncHandler( async(req,res)=>{
    const {oldPassword,newPassword}=req.body

   const user= await User.findById(req.user?._id)
   const isPasswordCorrect=await user.isPasswordCorrect(oldPassword);

   if(!isPasswordCorrect){
    throw new ApiError(400,"Invalid old password");
   }
   user.password=newPassword;
   user.save({validateBeforeSave:false})

   return res
   .status(200
    .json(
        new ApiResponse (
            200,{},"Password Changed Successfully"
        )
    )
   )
})

const getCurrentUser =asyncHandler(async (req,res)=>{

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            req.user,
            "User details fetched successfully"
        )
    )
})

const updateAccountDetails= asyncHandler(async (req,res)=>{
    const {fullName,email}=req.body

    if(!fullName || !email){
        throw new ApiError(400,"Username or Password must be changed")
    }

   const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{fullName,email}
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        200,
        user,
        "Account details updated successfully"
    )

})


const updateUserAvatar= asyncHandler (async( req,res)=>{

    const avatarLocalPath= req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }
    const avatar= await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError("Error while uploading file of avatar")

    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            avatar:avatar.url
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        200,user,"Avatar updated successfully"
    )
})

const updateUserCoverImage= asyncHandler (async( req,res)=>{

    const coverImageLocalPath= req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError("Error while uploading file of cover Image")

    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            coverImage:coverImage.url
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        200,user,"cover Image updated successfully"
    )
})

export {registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage}