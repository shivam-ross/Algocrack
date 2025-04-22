'use client'
import { useParams, useRouter } from "next/navigation"
import AdminProblem from "../../components/adminProblem";
import { useEffect, useState } from "react";

export default function EditProblem () {
    const router = useRouter();
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
    };

    const handleDelete = async () => {
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
    };
    

    useEffect(() => {
        const fetchProblem = async () => {
            const res = await fetch(`/api/problems/${id}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });
            if (res.ok) {
                const data = await res.json();
                setTitle(data.problem.title);
                setDescription(data.problem.description);
                setDifficulty(data.problem.difficulty);
                setTags(data.problem.tags);
                setTestCases(data.testCases);
                setFunctionName(data.problem.functionName);
                setReturnType(data.problem.returnType);
                setArgs(data.problem.args);
            } else {
                alert("Failed to fetch problem");
            }
        };
        fetchProblem();
    }, [id]);
    return(
        <div className="p-4 bg-purple-100 min-h-screen space-y-4">
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