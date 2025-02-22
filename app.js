const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const cors = require("cors");
const globalErrorHandler = require("./controllers/errorController");
const userRouter = require("./routes/userRoutes");
const postRouter = require("./routes/postRoutes");


const path = require("path");
const AppError = require("./utils/appError.js");
const app = express();
app.use("/",express.static("uploads"));
app.use(cookieParser());
app.use(helmet());
app.use(cors(
    {
        origin:["http://localhost:3000"],
        credentials:true,
    }
));

app.use(express.static(path.join(__dirname, "public")));
if(process.env.NODE_ENV==="development"){
    app.use(morgan("dev"));
}

app.use(express.json({limit:"10kb"}));
app.use(mongoSanitize());


app.use("/api/v1/users",userRouter);
app.use("/api/v1/posts",postRouter);
app.all("*", (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;

