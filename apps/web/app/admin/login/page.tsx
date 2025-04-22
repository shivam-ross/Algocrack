'use client'

import { useState } from "react";
import { AdminLogin } from "../../actions/adminLogin";

export default function LoginAdmin (){
    const [adminKey, setAdminKey] = useState("");


    function handlelogin(){AdminLogin(adminKey);}

    return(
        <div className="bg-purple-200 h-screen flex flex-col justify-center items-center">
           <div className="border-2 border-gray-800 rounded-lg p-4">
            <h2 className="text-gray-800 font-semibold font-mono">Enter Admin Key</h2>
            <input
            onChange={(e) => setAdminKey(e.target.value)}
            value={adminKey}
            type="text"
            placeholder="Admin Key"
            className="text-lg border-2 border-gray-800 rounded-md m-2 p-2 font-mono text-gray-800 font-semibold"
            />
            <button onClick={handlelogin}
             className="m-2 p-2 text-xl font-bold bg-gray-800 text-gray-200 rounded-md"
             >Login</button>
           </div>
        </div>
    )
}