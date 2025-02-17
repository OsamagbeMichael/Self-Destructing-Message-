import { useState } from "react";
import axios from "axios";
/* */
{/* */ }
export default function Chatroom() {
    const [chatroomId, setChatroomId] = useState(""); /* Tracks selected chatroom*/
    const [message, setMessage] = useState(""); /* stores current message being typed*/
    const [messages, setMessages] = useState([]); /* maintains a list of messages */
    const [isLoading, setIsLoading] = useState(false) /*Manages loading state */
    // need to know whether a process is ongoing 
    const API_BASE = "http://localhost:3000"; // where API request are sent 
    //1.) Create a new chatroom
    const createChatroom = async () => {
        try {
            const res = await axios.post(`${API_BASE}/create-room`);// sends post request to chatroom 
            setChatroomId(res.data.chatroomId); // update chatroom Id with new chatroom ID 
            setMessages([]); // Reset messages for new chatroom

        } catch (error) {
            console.error("Error creating chatroom", error);
        }
    };
    //2.) send message in chatroom 
    const sendMessage = async () => {
        if (!message.trim()) return;// check if the message is empty 

        try {
            await axios.post(`${API_BASE}/send-message`,
                {
                    chatroomId, // id chatroom where message being sent 
                    message //sends message to the text. 
                });
            setMessages([...messages, { text: message }]); // Updates UI instantly
            setMessage(""); // clears input field after message sent
        } catch (error) {
            console.error("Error sending message", error);
        }
    };

    // 3.) Retrieve and self-destruct messages for a particular chatroom  
    const fetchMessages = async () => {
        if (!chatroomId) return;

        try {
            setIsLoading(true);
            const res = await axios.get(`${API_BASE}/messages/${chatroomId}`); // fetch message from AP
            setMessages(res.data.messages); // updates message state 
        } catch (error) {
            if (error.response && error.response.status === 404) {
                setMessages([{ text: "Chatroom expired or does not exist. " }]);

            } else {
                console.error("Error fetching messages", error);
            }

        } finally {
            setIsLoading(false);
        }
    };
    return (
        <div className="chat-container">
            <h2> Darknet Comms</h2>
            {/* Create Chatroom Button */}
            {/* button creates chatroom if none,  */}
            <button onClick={createChatroom} disabled={chatroomId}>


                {chatroomId ? `Chatroom: ${chatroomId}` : "Create Chatroom"}
            </button>

            {/* Message Input*/}
            {/* only appears if a chatroom already exists*/}
            {
                chatroomId && (
                    <div>
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type a message..."
                        />
                        <button onClick={sendMessage}>Send Message</button>
                        <button onClick={fetchMessages}>{isLoading ? "Loading..." : "Read Messages"}</button>
                    </div>

                )}
            {/*Display Messages */}
            {/*displays each message and renders them in a p tag */}
            {/* If there are no messages,it says no message left */}
            <div className="messages">
                {messages.length > 0 ? (
                    messages.map((msg, index) => (
                        <p key={index} className="message"> {msg.text}</p>
                    ))
                ) : (
                    <p> No messages yet. </p>
                )}
            </div>
        </div>
    );
}
