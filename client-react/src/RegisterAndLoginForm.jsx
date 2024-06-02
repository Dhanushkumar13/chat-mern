import { useContext, useState } from "react"
import axios from 'axios';
import {UserContext} from './UserContext'

export default function RegisterAndLoginForm(){
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginOrRegister, setLoginOrRegister] = useState('Login')
    const {setUsername: setLoggedInUsername, setId} = useContext(UserContext);

    async function handleSubmit(e) {
        e.preventDefault();
        const url = isLoginOrRegister === 'Register' ? 'Register' : 'Login';
        try {
            const {data} = await axios.post(url, { username, password });
            setLoggedInUsername(username);
            setId(data.id) 
        } catch (error) {
            if (error.response) {
                console.error(error.response.data);
            }
        }
    }
    
    return(
        <div className="bg blue-50 h-screen flex items-center">
            <form className="w-64 mx-auto mb-12" onSubmit={handleSubmit}>
            <input value={username}
                    onChange={(e)=> setUsername(e.target.value)} 
                    type="text" 
                    placeholder="username" 
                    className="block w-full rounded-sm p-2 mb-2 border"></input>
            <input value={password}
                   onChange={(e)=> setPassword(e.target.value)} 
                   type="password" 
                   placeholder="password" 
                   className="block w-full rounded-sm p-2 mb-2 border"></input>
            <button className="bg-blue-500 text-white block w-full rounded-sm p-2">{isLoginOrRegister === 'Register' ? 'Register' : 'Login'}</button>
            <div className="text-center mt-2">Already a user? 
            {isLoginOrRegister === 'Register' && (
                <div>
                    <button onClick={()=> setLoginOrRegister('Login')} href="">Login here</button>
                </div>
            )}
            {isLoginOrRegister ==='Login' && (
                <div>
                    Don't have an account?
                    <button onClick={()=> setLoginOrRegister('Register')}>
                        Register
                    </button>
                </div>
            )}
                </div>
            </form>
        </div>
    )
}