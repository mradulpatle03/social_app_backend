const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/catchAsync");
const User = require("../models/userModel");
const AppError = require("../utils/appError");


const isAuthenticated = catchAsync(async (req, res, next) => {
    const token = req.cookies.jwt || req.headers.authorization.split(" ")[1];
    if (!token) {
        return next(new AppError("You are not logged in", 401));
    }   

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded.id);

    if (!currentUser) {
        return next(new AppError("The user belonging to this token does no longer exist", 401));
    }
    req.user = currentUser;
    next();
});

module.exports = isAuthenticated