const app = require("./app");
const dotenv = require("dotenv");
process.on("uncaughtException", (err) => {
    console.log("UNCAUGHT EXCEPTION! 💥 Shutting down...");
    console.log(err.name, err.message);
    process.exit(1);
})
dotenv.config({path:"./config.env"});
const mongoose = require("mongoose");

const port = process.env.PORT || 3001;

mongoose
    .connect(process.env.DB)
    .then(()=>{
    console.log("DB connection successful");
    })
    .catch((err)=>{
    console.log(err);
    });


const server = app.listen(port, () => {
    console.log(`App running on port ${port}...`);
})

process.on("unhandledRejection", (err) => {
    console.log("UNHANDLED REJECTION! 💥 Shutting down...");
    console.log(err.name, err.message);
    server.close(() => {
        process.exit(1);
    })
})