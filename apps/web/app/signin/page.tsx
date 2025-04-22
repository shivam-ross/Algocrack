'use client';

import { signIn, useSession } from "next-auth/react";
import Image from "next/image";
import { GoogleIcon } from "../components/icons/googleIcon";
import { GithubIcon } from "../components/icons/githubIcon";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
export default function SignIn() {
    const session = useSession();
    const router =useRouter();

    useEffect(()=> {
        if (session.status === "authenticated") {
            router.push("/");
        }
    },[router, session.status]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-purple-200">
        <div className="flex items-center gap-2 mb-4">
            <Image
            src="/logo.svg"
            alt="Logo"
            width={100}
            height={100}
            className="bg-purple-200 w-20 h-20 rounded"
        />
        <h1 className="text-4xl font-nono font-semibold text-black">AlgoCrack</h1>
        </div>
      <div className="flex flex-col p-4 border-2 border-gray-800 items-center bg-gray-800 rounded-lg">
        <div
        onClick={()=> signIn('google')}
        className="flex justify-center items-center gap-2 bg-purple-200 rounded text-gray-800 w-[320px] p-2 text-gray-800 text-lg font-mono font-md m-2"
        >
            <h3> Sign In with </h3>
            <GoogleIcon/>
        </div>
        <div
        onClick={()=> signIn('github')}
        className="flex justify-center items-center gap-2 bg-purple-200 rounded text-gray-800 w-[320px] p-2 text-gray-800 text-lg font-mono font-md m-2"
        >
            <h3> Sign In with </h3>
            <GithubIcon/>
        </div>
      </div>
    </div>
  );
} 


  