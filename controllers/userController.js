const catchAsync = require("../utils/catchAsync");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const getDataUri = require("../utils/datauri");
const {uploadToCloudinary} = require("../utils/cloudinary");

exports.getProfile = catchAsync(async function(req,res,next){
    const {id}=req.params;
    const user = await User.findById(id).select("-password -passwordConfirm -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires").populate({
        path:'posts',
        options:{sort:{createdAt:-1}},
    }).populate({
        path:"savedPosts",
        options:{sort:{createdAt:-1}},
    })
    if(!user){
        return next(new AppError("User not found",404));
    }
    res.status(200).json({
        success:true,
        data:{
            user
        }
    })

})

exports.editProfile = catchAsync(async function(req,res,next){
    const userId = req.user.id;
    const {bio} = req.body;
    const profilePicture = req.file;

    let cloudResponse ;
    if(profilePicture){
        const fileUri = getDataUri(profilePicture);
        cloudResponse= await uploadToCloudinary(fileUri);
    }
    const user = await User.findById(userId).select("-password");
    if(!user){
        return next(new AppError("User not found",404));
    }
    if(bio){
        user.bio = bio;
    }
    if(profilePicture){
        user.profilePicture = cloudResponse.secure_url;
    }
    await user.save({validateBeforeSave:false});
    res.status(200).json({
        success:true,
        message:"Profile successfully updated",
        status:"success",
        data:{
            user
        }
    })
})

exports.suggestedUser = catchAsync(async (req,res,next)=>{
    const loginUserId = req.user.id;
    const users = await User.find({_id:{ $ne:loginUserId }}).select("-password -passwordConfirm -otp -otpExpires -resetPasswordOtp -resetPasswordOtpExpires");

    res.status(200).json({
        success:true,
        data:{
            users
        }
    })
})

exports.followUnFollow = catchAsync(async (req,res,next)=>{
    const loginUserId = req.user.id;
    const targetUserId = req.params.id;
    if(!loginUserId.toString()===targetUserId){
        return next(new AppError("You cannot follow/unfollow yourself",400));
    }
    const targetUser = await User.findById(targetUserId);
    if(!targetUser){
        return next(new AppError("User not found",400));
    }
    const isFollowing = targetUser.followers.includes(loginUserId);
    if(isFollowing){
        await Promise.all([
            User.updateOne({_id: loginUserId},{$pull:{following:targetUserId}}),
            User.updateOne({_id: targetUserId},{$pull:{followers:loginUserId}})
        ])
    }
    else{
        await Promise.all([
            User.updateOne({_id: loginUserId},{$addToSet:{following:targetUserId}}),
            User.updateOne({_id: targetUserId},{$addToSet:{followers:loginUserId}})
        ])
    }

    const updatedLoggedInUser = await User.findById(loginUserId).select("-password");

    res.status(200).json({
        message: isFollowing ? "Unfollowed successfully" :"followed successfully",
        status:"success",
        data:{
            user: updatedLoggedInUser,
        }
    })
})

exports.getMe = catchAsync(async (req,res,next)=>{
    const user = req.user;
    if(!user){
        return next(new AppError("User not authenticated",404));
    }
    res.status(200).json({
        status:"success",
        message:"Authenticated successfully ",
        data:{
            user
        }
    })
})