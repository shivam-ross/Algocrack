'use client'
import { useEffect, useState } from "react";
import { Topbar } from "../components/topbar";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Submission() {
  const session = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<{
      id: string,
      status: "PENDING" | "ACCEPTED" | "WRONG_ANSWER" | "TIME_LIMIT_EXCEEDED" | "RUNTIME_ERROR" | "COMPILE_ERROR",
      language: "CPP" | "PYTHON" | "JAVASCRIPT",
      problemName: string,
}[]>([]);

useEffect(()=> {
  if(session.status == "unauthenticated"){
    router.push("/signin");
  }
},[session, router])

useEffect(() => {
  setLoading(true);
    const fetchSubmission = async () => {
      const res = await fetch("/api/submission", {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      } else {
        console.log("Failed to fetch submission");
      }
      setLoading(false);
    };
    fetchSubmission();

},[]);


  
return (
    <div className="bg-purple-200 min-h-screen">
      <Topbar/>
      <div className="flex flex-col justify-center items-center text-gray-800 h-[calc(100vh-112px)]">
                <div className="w-full lg:w-[80vw] h-full overflow-y-scroll scrollbar-hidden overflow-x-hidden">
                  <div className="grid grid-cols-3 w-full justify-items-center px-3 py-2 sticky top-0 z-10 bg-purple-200">
                    <h2 className="text-lg font-bold justify-self-start">Problem</h2>
                    <h2 className="text-lg font-bold">Language</h2>
                    <h2 className="text-lg font-bold">Status</h2>
                  </div>
                  {(loading) ? <div className="flex flex-col justify-center items-center h-full font-mono text-xl text-gray-800">Loading...</div> : submissions.map((submission) => (
                                  <div key={submission.id}>
                                    <div className="grid grid-cols-3 w-full justify-items-center my-2 px-3 border-b py-2 mx-3">
                  <h2 className="text-md text-black justify-self-start">{submission.problemName}</h2>
                  <h2 className="text-md text-gray-800">{submission.language}</h2>
                  <h2 className={`text-md ${(submission.status == "ACCEPTED")? "text-green-500" : "text-red-500"}`}>{submission.status}</h2>
                </div>
                                  </div>
                              ))}
                  
                </div>
              </div>
    </div>
  );
}
