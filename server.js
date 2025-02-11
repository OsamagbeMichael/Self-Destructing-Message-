require('dotenv').config(); // load env variables
const express = require('express'); // creates express app
const cors = require('cors');  // used to enable API to be accessed from different domains 
const { v4: uuidv4 } = require('uuid'); // allows us create unique IDs 
const redis = require('redis');

//creates express app
const app = express();
const PORT = process.env.PORT || 3000;

//Middleware
// allows request from different origins
app.use(cors());
app.use(express.json());


// redis client 
// handles redis client 
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
})

redisClient.connect().then(() => console.log("Connected to Redis")).catch(err => console.error("Redis connection error:", err));

//Basic route API route
app.get('/', (req, res) => {
    res.send({ message: "Darknet comms API is running" });
});

//start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// (1) create a route to generate chatroom ID , (2) store the chatroom in redis with an expiration time , (3) return chatroom ID to client 
app.post('/create-room', async (req, res) => {

    try {
        const chatroomId = uuidv4(); // get unique chatroom id 
        const ttl = 1200; //Chatroom expires in 20 minutes(600 seconds)
        //big hitter, waiting for our room to timeout
        await redisClient.setEx(`chatroom:${chatroomId}`, ttl, "active");
        // tl:dr : redisclient.setEx sets key with expiration time , 
        res.json({ chatroomId, message: "Chatroom created successfully", expiresIn: ttl });
        // tl:dr: sends request back to client 
    } catch (error) {
        console.error("Error creating chatroom: ", error);
        res.status(500).json({ error: "Failed to create chatroom" });
    }
});

// endpoint to send a message to a chatroom
app.post('/send-message', async (req, res) => {
    try {
        const { chatroomID, message } = req.body;


        // validate input ensuring we have a chatroom running 
        if (!chatroomId || !message) {
            return res.status(400).json({ error: 'chatroomId and message are required' });
        }
        // check if the chatroom exists
        const chatroomKey = `chatroom:${chatroomId}`;
        const chatroomStatus = await redisClient.get(chatroomKey);
        if (!chatroomStatus) {
            return res.status(404).json({ error: 'Chatroom not found or expired' });
        }


    } catch (error) {
        console.error("Error sending message: ", error);
        res.status(500).json({ error: "Failed to send message" });
    }
})
