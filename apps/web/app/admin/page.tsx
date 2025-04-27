'use client'
import { useEffect, useState } from "react";
import { Problem } from "../components/problem";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function Admin(){
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [problems, setProlems] = useState<Array<{
        id: string;
        title: string;
        description: string;
        difficulty: "EASY" | "MEDIUM" | "HARD";
        tags: string;
    }>>([])


    useEffect(() => {
        setLoading(true);

        const fetchProblems = async () => {
            const res = await fetch("/api/problems", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });
            if (res.ok) {
                const data = await res.json();
                setProlems(data);
            } else {
                alert("Failed to fetch problems");
            }
            setLoading(false);
        };
        fetchProblems();
    }, []);

    
    return(
        <div className="bg-purple-200">
            <div className="flex flex-col justify-center items-center pb-6">
                <div className="flex items-center justify-between p-4 bg-gray-800 text-gray-200 w-full lg:w-[90vw]">
                    <div className="flex items-center gap-3">
                        <Image
                    src={"/logo.svg"}
                    height={100}
                    width={100}
                    alt="logo"
                    className="bg-purple-200 w-10 h-10"/>
                    <h2 className="font-mono text-xl">Algocrack</h2>
                    </div>
                    <div className="">
                        <button
                        onClick={()=> router.push("/admin/create")}
                        className="bg-purple-200 text-gray-800 m-2 p-2 rounded-lg font-semibold font-mono">Create New</button>
                    </div>
                </div>
                </div>
            <div className="flex flex-col justify-center items-center text-gray-800 h-[calc(100vh-112px)]">
                <div className="w-full lg:w-[80vw] h-full overflow-y-scroll scrollbar-hidden overflow-x-hidden">
                    <div className="grid grid-cols-3 w-full justify-items-center px-3 py-2 sticky top-0 z-10 bg-purple-200">
                        <h2 className="text-lg font-bold justify-self-start">Title</h2>
                        <h2 className="text-lg font-bold">Difficulty</h2>
                        <h2 className="text-lg font-bold">Tags</h2>
                    </div>
                    { (loading) ? <div className="flex flex-col h-full items-center justify-center text-gray-800 font-mono text-lg">loading...</div> :
                    problems.map((problem) => (
                        <div key={problem.id} onClick={()=> router.push(`admin/${problem.id}`)}>
                            <Problem
                                key={problem.id}
                                title={problem.title}
                                difficulty={problem.difficulty}
                                tags={problem.tags}
                            />
                        </div>
                    ))
                }
                </div>
            </div>
        </div>
    )
}