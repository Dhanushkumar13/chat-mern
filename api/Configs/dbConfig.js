const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');
let URI;
if(process.env.NODE_ENV === 'production'){
    URI = process.env.NODE_MONGO_DB_USERNAME;
}

console.log(process.env.NODE_MONGO_DB_USERNAME);
mongoose
.connect(`${URI}`)
.then((data)=>{
    console.log('CONNECT TO::', URI)
})
.catch((err)=>{
    console.log("ERROR COULDN'T CONNECT TO DATABASE",err);
})