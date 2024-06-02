const express = require('express');
const dotenv = require('dotenv');
const app = express();
const jwt = require('jsonwebtoken');
const user = require('./models/User');
const Message = require('./models/Message');
const cors = require('cors')
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser')
const ws = require('ws');
const fs = require('fs');

dotenv.config();
require("./Configs/dbConfig");
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);
app.use(express.json())
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
}));
app.use('/uploads',express.static(__dirname + '/uploads'))

async function getUserDataFromRequest(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies.token;
        if (token) {
            jwt.verify(token, jwtSecret, {}, (err, userData) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(userData);
                }
            });
        } else {
            reject('no token');
        }
    });
}

app.get('/test',(req,res)=>{
    console.log('ok')
    res.json('test ok');
    
})

app.get('/messages/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const userData = await getUserDataFromRequest(req);
        const ourUserId = userData.userId;
        const messages = await Message.find({
            sender: { $in: [userId, ourUserId] },
            recipient: { $in: [userId, ourUserId] },
        }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/people', async (req,res)=>{
    const users = await user.find({}, {'_id':1, 'username':1})
    res.json(users);
})


app.get('/profile', (req,res)=>{
    const token = req.cookies.token;
    if(token){
        jwt.verify(token, jwtSecret, {} , (err, userData)=>{
            if(err) throw err;
            res.json(userData)
        })
    } else{
        res.status(400).json('no token')
    }

})

app.post('/login',async (req,res)=>{
    const {username, password} = req.body;
    const foundUser = await user.findOne({username})
    if(foundUser){
        const passOk = bcrypt.compareSync(password, foundUser.password)
        if(passOk){
            jwt.sign({ userId: foundUser._id, username }, jwtSecret, {}, (err, token)=>{
                res.cookie('token', token).json({
                    id: foundUser._id,
                })
            })
        }
    }
})

app.post('/logout', (req,res)=>{
    res.cookie('token', '', {sameSite:'none', secure:true}).json('ok');
})

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Check if the username already exists
        const existingUser = await user.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Create a new user if the username doesn't exist
        const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
        const createdUser = await user.create({ username: username, password: hashedPassword});
        jwt.sign({ userId: createdUser._id, username }, jwtSecret, {}, (err, token) => {
            if (err) throw err;
            res.cookie('token', token, {sameSite: 'none', secure: true}).status(201).json({
                id: createdUser._id,
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json('error');
    }
});

const server = app.listen(4040);

const wss = new ws.WebSocketServer({server});

function notifyAboutOnlinePeople(){
    [...wss.clients].forEach(clients =>{
        clients.send(JSON.stringify({
            online: [...wss.clients].map(c => ({userId: c.userId, username: c.username}))
        }    
        ));
    })
}

wss.on('connection', (connection, req)=>{

    connection.isAlive = true;

    connection.timer = setInterval(()=>{
        connection.ping()
        connection.death = setTimeout(()=>{
            connection.isAlive = false;
            clearTimeout(connection.timer);
            connection.terminate();
            notifyAboutOnlinePeople();
            console.log('dead')
        }, 1000)
    }, 5000);

    connection.on('pong', ()=>{
        clearTimeout(connection.death)
    })

    //read username and id form the cookie for this connection
    const cookies = req.headers.cookie;
    if(cookies){
        const tokenCookieString = cookies.split(';').find(str => str.startsWith('token='))
        if(tokenCookieString){
            const token = tokenCookieString.split('=')[1];
            if(token){
                jwt.verify(token, jwtSecret, {}, (err, userData)=>{
                    if(err) throw err;
                    const {userId, username} = userData;
                    connection.userId = userId;
                    connection.username = username;
                })
            }
        }
    }
    connection.on('message', async (message)=> {
        const messageData = JSON.parse(message.toString());
        const {recipient, text, file} = messageData;
        let filename = null;
        if(file){
            console.log('size', file.data.length);
            const parts = file.name.split('.');
            const ext = parts[parts.length -1 ];
            filename = Date.now() + '.'+ ext;
            const path = __dirname + '/uploads/' + filename
            const bufferData = Buffer.from(file.data.split(',')[1], 'base64');
            fs.writeFile(path, bufferData, (err)=>{
                if(err){
                    console.error("Error saving file", err);
                    return;
                }
                console.log('file saved'+path);
            })
        }
        if(recipient && (file || text)){
            const messageDoc = await Message.create({
                sender: connection.userId,
                recipient,
                text,
                file: file ? filename : null,
            });
            console.log('created');
            [...wss.clients]
            .filter(c => c.userId === recipient)
            .forEach(c => c.send(JSON.stringify({
                text, 
                sender: connection.userId,
                recipient,
                file: file ? filename : null,
                _id: messageDoc._id,
            })));
        }
    });
    //notify everyone about online persons in the app;
    notifyAboutOnlinePeople();
});
