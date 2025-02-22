const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const generateOtp = require("../utils/generateOtp");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const fs = require("fs");
const hbs = require("hbs");
const sendEmail = require("../utils/email");
const path = require("path");



const loadTemplate = (templateName,replacements) => {
    const templatePath = path.join(__dirname,"../emailTemplate",templateName);
    const source =fs.readFileSync(templatePath,'utf-8');
    const template = hbs.compile(source);
    return template(replacements);

}

const signToken = (id) => {
    return jwt.sign({id}, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    })
}

const createSendToken = (user, statusCode, res , message) => {
    const token = signToken(user._id);
    const cookieOptions = {
        expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    };
    
    res.cookie("jwt", token, cookieOptions);
    user.password = undefined;
    user.otp = undefined;
    res.status(statusCode).json({
        status: "success",
        message: message,
        token,
        data: {
            user
        }
    })
}

exports.signup = catchAsync(async (req, res, next) => {
    const {email, password, passwordConfirm, username} = req.body
    const existingUser = await User.findOne({email});

    if(existingUser){   
        return next(new AppError("User already exists", 400))
    }
    const otp = generateOtp();
    const otpExpires = Date.now() + 24 * 60 * 60 * 100;
    const newUser = await User.create({
        username,
        email,
        password,
        passwordConfirm,
        otp,
        otpExpires
    });

    const htmlTemplate = loadTemplate("otpTemplate.hbs",{
        title: "OTP verification",
        username: newUser.username,
        otp,
        message: "Please enter the following OTP to verify your account",
    })
    try {
        await sendEmail({
            email: newUser.email,
            subject: "OTP verification",
            html: htmlTemplate
        })
        createSendToken(newUser, 201, res, "OTP sent successfully");
    } catch (error) {
        await User.findByIdAndDelete(newUser._id);
        return next(new AppError("there is error creating the account", 500))
    }
})

exports.verifyAccount = catchAsync(async (req, res, next) => {
    const {otp} = req.body;
    if(!otp){
        return next(new AppError("Please enter the OTP", 400))
    }
    const user = req.user;
    if(user.otp !== otp){
        return next(new AppError("Invalid OTP", 400))
    }
    
    if(user.otpExpires < Date.now()){
        return next(new AppError("OTP expired", 400))
    }
    user.otp = undefined;
    user.otpExpires = undefined;
    user.isVerified = true;
    await user.save({validateBeforeSave: false});
    createSendToken(user, 200, res, "Account verified successfully");
})

exports.resendOtp = catchAsync(async(req,res,next)=>{
    const {email} = req.user;
    if(!email){
        return next(new AppError("Email is required", 400))
    }
    const user = await User.findOne({email});
    if(!user){
        return next(new AppError("User not found", 400))
    }
    if(user.isVerified){
        return next(new AppError("User is already verified", 400))
    }
    const otp = generateOtp();
    const otpExpires = Date.now() + 24 * 60 * 60 * 1000;
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save({validateBeforeSave: false});
    const htmlTemplate = loadTemplate("otpTemplate.hbs",{
        title: "OTP verification",
        username: user.username,
        otp,
        message: "Please enter the following OTP to verify your account",
    })
    try {
        await sendEmail({
            email: user.email,
            subject: "Resend OTP for email verification",
            html: htmlTemplate
        })
        res.status(200).json({
            status: "success",
            message: "OTP sent successfully"
        })
    } catch (error) {
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save({validateBeforeSave: false});
        return next(new AppError("there is error creating the account", 500))
    }

})

exports.login = catchAsync(async (req, res, next) => {
    const {email, password} = req.body;
    if(!email || !password){
        return next(new AppError("Please provide email and password", 400))
    }
    const user = await User.findOne({email}).select("+password");
    if(!user || !(await user.correctPassword(password,user.password))){
        return next(new AppError("incorrect email or password",401));
    }
    createSendToken(user,200,res,"login successfully");
})
exports.logout = catchAsync(async (req, res, next) => {
    res.cookie("token","loggedOut",{
        expires:new Date(Date.now() +10 * 1000),
        httpOnly: true,
        secure:process.env.NODE_ENV === "production",
    })
    res.status(200).json({
        status: "success",
        message:"Logged Out", 
    })
})

exports.forgetPassword = catchAsync(async (req, res, next) => {
    const {email} = req.body;
    const user = await User.findOne({ email });

    if(!user){
        return next(new AppError("incorrect email or password", 401));
    }
    const otp = generateOtp();
    const resetExpires = Date.now() + 5 * 60 * 1000;//5 min
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = resetExpires;

    await user.save({validateBeforeSave:false});

    const htmlTemplate = loadTemplate("otpTemplate.hbs",{
        title: "Reset Password OTP",
        username:user.username,
        otp,
        message: "Please enter the following OTP to verify your account",
    })
    try{
        await sendEmail({
            email : user.email,
            subject:"Reset Password OTP(valid for 5 min)",
            html: htmlTemplate
        })
        res.status(200).json({
            status: "success",
            message:"Reset Password OTP sent successfully",
        })
    }catch{
        user.resetPasswordOtpExpires = undefined;
        user.resetPasswordOtp = undefined;
        await user.save({validateBeforeSave : false});

        return next(new AppError("there is error sending the email. Try again later", 500));
    }
})

exports.resetPassword = catchAsync(async (req, res, next) => {
    const {email,otp,password , passwordConfirm} = req.body;
    const user = await User.findOne({email,resetPasswordOtp:otp,resetPasswordOtpExpires:{ $gt :Date.now()}});

    if(!user){
        return next(new AppError("incorrect email or password", 401));
    }
    user.password = password;
    user.passwordConfirm = passwordConfirm;
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpires = undefined;
    await user.save();
    createSendToken(user,200,res,"Password Reset Successfully");
})

exports.changePassword = catchAsync(async (req, res, next) => {
    const {currentPassword, newPassword,newPasswordConfirm} = req.body;
    const {email}= req.user;
    const user = await User.findOne({email}).select("+password");
    if(!user){
        return next(new AppError("User Not Found", 404));
    }
    if(!(await user.correctPassword(currentPassword,user.password))){
        return next(new AppError("Incorrect CurrentPassword", 400));
    }
    if(newPassword !== newPasswordConfirm){
        return next(new AppError("Incorrect NewPassword", 400));
    }
    user.password = newPassword;
    user.passwordConfirm = newPasswordConfirm;
    await user.save();
    createSendToken(user,200,res,"Password Changed Successfully");
})

