'use client'
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Problem } from "./problem";



export function Problems(){

    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [problems, setProlems] = useState<{
        id: string;
        title: string;
        description: string;
        difficulty: 'Easy' | 'Medium' | 'Hard';
        tags: string;
    }[]>([]);

    function handleClick(id: string){
        router.push(`/${id}`);
    }

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

    if (loading) return <div className="flex flex-col justify-center items-center font-mono text-xl text-gray-800 h-[calc(100vh-112px)]">Loading...</div>

    return (
        <div className="flex flex-col justify-center items-center text-gray-800 h-[calc(100vh-112px)]">
          <div className="w-full lg:w-[80vw] h-full overflow-y-scroll scrollbar-hidden overflow-x-hidden">
            <div className="grid grid-cols-3 w-full justify-items-center px-3 py-2 sticky top-0 z-10 bg-purple-200">
              <h2 className="text-lg font-bold justify-self-start">Title</h2>
              <h2 className="text-lg font-bold">Difficulty</h2>
              <h2 className="text-lg font-bold">Tags</h2>
            </div>
      
            {problems.map((problem) => (
                <div onClick={() => handleClick(problem.id)} key={problem.id}>
                <Problem
                  title={problem.title}
                  difficulty={problem.difficulty}
                  tags={problem.tags}
                />
                </div>
            ))}
          </div>
        </div>
      );
      
}
