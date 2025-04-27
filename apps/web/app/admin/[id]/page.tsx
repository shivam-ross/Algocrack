'use client'
import { useParams, useRouter } from "next/navigation"
import AdminProblem from "../../components/adminProblem";
import { useEffect, useState } from "react";

export default function EditProblem () {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [difficulty, setDifficulty] = useState("EASY");
    const [tags, setTags] = useState("");
    const [functionName, setFunctionName] = useState("");
    const [returnType, setReturnType] = useState("string");
    const [args, setArgs] = useState<{ name: string; type: string }[]>([{ name: "", type: "number" }]);
    const [testCases, setTestCases] = useState(Array.from({ length: 4 }, () => ({ input: "", output: "" })));
    const { id } = useParams();

    const handleSubmit = async () => {
        setLoading(true);

        const payload = {
            title,
            description,
            difficulty,
            tags,
            functionName,
            returnType,
            args,
            testCases,
          };
        const res = await fetch(`/api/problems/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
            headers: {
                "Content-Type": "application/json"
            }
        });
        if (res.ok) {
            alert("Problem updated successfully!");
            router.push("/admin");
        } else {
            alert("Failed to update problem");
        }

        setLoading(false);
    };

    const handleDelete = async () => {
        setLoading(true);
        const res = await fetch(`/api/problems/${id}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json"
            }
        });
        if (res.ok) {
            alert("Problem deleted successfully!");
            router.push("/admin");
        } else {
            alert("Failed to delete problem");
        }
        setLoading(false);
    };
    

    useEffect(() => {
        setLoading(true);

        const fetchProblem = async () => {
            const res = await fetch(`/api/problems/${id}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });
            if (res.ok) {
                const data = await res.json();
                setTitle(data.title);
                setDescription(data.description);
                setDifficulty(data.difficulty);
                setTags(data.tags);
                setTestCases(data.testCases);
                setFunctionName(data.functionName);
                setReturnType(data.returnType);
                setArgs(data.args);
            } else {
                alert("Failed to fetch problem");
            }
            setLoading(false);
        };
        fetchProblem();
    }, [id]);

    if(loading) return <div className="bg-purple-200 flex flex-col justify-center items-center font-mono text-xl text-ray-200 h-screen">Loading...</div>
    return(
        <div className="p-4 bg-purple-200 min-h-screen space-y-4">
      <div className="flex justify-between bg-gray-800 text-white p-3 rounded">
        <button onClick={handleDelete} className="bg-red-300 text-gray-800 px-4 py-2 rounded">Delete</button>
        <button onClick={handleSubmit} className="bg-green-300 text-gray-800 px-4 py-2 rounded">Save</button>
      </div>
            <AdminProblem
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            tags={tags}
            setTags={setTags}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            testCases={testCases}
            setTestCases={setTestCases}
            functionName={functionName}
            setFunctionName={setFunctionName}
            returnType={returnType}
            setReturnType={setReturnType}
            args={args}
            setArgs={setArgs}
            />
        </div>
    )
}