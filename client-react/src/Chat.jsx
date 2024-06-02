import { useEffect, useRef, useState } from "react"
import Avatar from "./Avatar";
import Logo from "./Logo";
import axios from 'axios';
import { useContext } from "react";
import { UserContext } from "./UserContext";
import {uniqBy} from "lodash";
import Contact from "./Contact";

export default function Chat(){
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({})
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [newMessageText, setNewMessageText] = useState('');
    const [messages, setMessages] = useState([]);
    const [offlinePeople, setOfflinePeople] = useState({})
    const divUnderMessages = useRef();

    const {username, id, setId, setUsername} = useContext(UserContext)
    useEffect(()=>{
        connectToWs();
    }, [])

    function connectToWs(){
        const ws = new WebSocket('ws://localhost:4040');
        setWs(ws);
        ws.addEventListener('message', handleMessage);
        ws.addEventListener('close', ()=> {
            setTimeout(()=>{
                console.log('Disconnected. Trying to Reconnect');
                connectToWs();
            }, 1000)
        })
    }

    function showOnlinePeople(peopleArray){
        const people = {};
        peopleArray.forEach(({userId, username}) =>{
            people[userId] = username;
        })
        setOnlinePeople(people)
    }

    function handleMessage(e){
        const messageData = JSON.parse(e.data);
        if('online' in messageData){
            showOnlinePeople(messageData.online)
        } else if('text' in messageData) {
            if(messageData.sender === selectedUserId){
                setMessages(prev => ([...prev, {...messageData}]));
            }
        }
    }
 
    function sendMessage(e, file= null){
        if(e) e.preventDefault();
        ws.send(JSON.stringify({
            recipient: selectedUserId,
            text: newMessageText,
            file,
        }));
        setNewMessageText('');
        setMessages(prevMessages => ([...prevMessages, 
            {
            text: newMessageText, 
            sender: id,
            recipient: selectedUserId,
            _id: Date.now(),
        }]));
        if(file){
            axios.get('/messages/'+selectedUserId)
            .then(res => {
              setMessages(res.data);
            });
        }else{
            setNewMessageText('');
        setMessages(prevMessages => ([...prevMessages, 
            {
            text: newMessageText, 
            sender: id,
            recipient: selectedUserId,
            _id: Date.now(),
        }]));
        }
    }

    function logout(){
        axios.post('/logout').then(()=>{
            setId(null);
            setUsername(null);
        })
    }

    function sendFile(e){
        const reader = new FileReader();
        reader.readAsDataURL(e.target.files[0]);
        reader.onload= () =>{
            sendMessage(null, {
                name: e.target.files[0].name,
                data: reader.result,
            })
        }
    }

    useEffect(() => {
        const div = divUnderMessages.current;
        if (div) {
            div.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages]);

    useEffect(()=>{
        axios.get('/people').then(res =>{
            const offlinePeopleArr = res.data
            .filter(p => p._id !== id)
            .filter(p => !Object.keys(onlinePeople).includes(p._id))
            const offlinePeople = {}
            offlinePeopleArr.forEach(p =>{
                offlinePeople[p._id] = p;
            })
            setOfflinePeople(offlinePeople)
        })
    }, [onlinePeople])

    useEffect(()=>{
        if(selectedUserId){
            axios.get('/messages/'+selectedUserId)
            .then(res => {
              setMessages(res.data);
            })
            .catch(error => {
              console.error('Error fetching messages:', error);
            });
        }
    }, [selectedUserId])

    const onlinePeopleExcludingOurs = {...onlinePeople};
    delete onlinePeopleExcludingOurs[id];

    const messagesWithoutDupes = uniqBy(messages, '_id');

    return(
        <div className="flex h-screen">
            <div className="bg-white w-1/3 flex flex-col">
                <div className="flex-grow">
                <Logo/>
                {Object.keys(onlinePeopleExcludingOurs).map(userId => (
                    <Contact 
                    key={userId}
                    id={userId} 
                    username={onlinePeopleExcludingOurs[userId]}
                    onClick={()=> setSelectedUserId(userId)}
                    selected={userId === selectedUserId}
                    online={true}
                    />
                ))}
                {Object.keys(offlinePeople).map(userId => (
                    <Contact
                    key={userId}
                    id={userId} 
                    username={offlinePeople[userId].username}
                    onClick={()=> setSelectedUserId(userId)}
                    selected={userId === selectedUserId}
                    online={false}
                    />
                ))}                
                </div>
                <div className="p-2 text-center flex items-center justify-center">
                    <span className="mr-2 text-sm text-gray-600 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>    
                        {username}
                    </span>
                    <button
                    onClick={logout} 
                    className="text-sm bg-blue-100 py-1 px-2 text-gray-500 rounded-sm">logout</button>
                </div>
            </div>

            <div className="flex flex-col bg-blue-50 w-2/3 p-2">
                <div className="flex-grow">
                    {!selectedUserId && (
                        <div className="flex h-full items-center justify-center">
                            <div className="text-gray-400 text-lg">&larr; Chat with a person </div>
                        </div>
                    )}
                    {selectedUserId && (
                        <div className="relative h-full">
                            <div className="overflow-x-hidden overflow-y-scroll absolute top-0 left-0 right-0 bottom-2">
                            {messagesWithoutDupes.map((message, index) => (
                            <div
                                key={index}
                                className={message.sender === id ? 'text-right' : 'text-left'}
                                ref={index === messagesWithoutDupes.length - 1 ? divUnderMessages : null}>
                                <div className={"text-left inline-block p-2 my-2 break-all rounded-md text-sm " + (message.sender === id ? 'text-white bg-blue-500' : 'text-gray-800 bg-white')}>
                                    {message.text}
                                    {message.file && (
                                        <div className="">                         
                                            <a target="_blank"className="underline flex items-center gap-1 border-b" href={axios.defaults.baseURL + '/uploads/' + message.file} >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                                            </svg> 
                                                {message.file}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                            ))}
                            </div>
                        </div>
)}
                </div>
                {!!selectedUserId && (
                    <form className="flex gap-2" onSubmit={sendMessage}>
                        <input type="text"
                        value={newMessageText}
                        onChange={e => setNewMessageText(e.target.value)}
                        className="bg-white flex-grow border p-2 rounded-sm" placeholder="type your message here"></input>
                        <label type="submit" className="bg-blue-200 p-2 text-gray-700 cursor-pointer rounded-sm border-blue-300">
                            <input type="file" className="hidden" onChange={sendFile}/>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                            </svg>
                        </label>
                        <button type="submit" className="bg-blue-500 p-2 text-white rounded-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                            </svg>
                        </button>
                    </form>  
                )}

            </div>            
        </div>
    )
}