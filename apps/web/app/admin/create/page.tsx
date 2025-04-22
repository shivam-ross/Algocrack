'use client'

import { useState } from 'react'
import AdminProblem from '../../components/adminProblem';
import { useRouter } from 'next/navigation';


export default function CreateProblem() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("EASY");
  const [tags, setTags] = useState("");
  const [functionName, setFunctionName] = useState("");
  const [returnType, setReturnType] = useState("string");
  const [args, setArgs] = useState<{ name: string; type: string }[]>([{ name: "", type: "number" }]);
  const [testCases, setTestCases] = useState(Array.from({ length: 4 }, () => ({ input: "", output: "" })));

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

    const res = await fetch("/api/problems", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (res.ok) {
      alert("Problem created successfully!");
      router.push("/admin");
      // reset form if needed
    } else {
      alert("Failed to create problem");
    }
  };

  return (
    <div className="p-4 bg-purple-100 min-h-screen space-y-4">
      <div className="flex justify-between bg-gray-800 text-white p-3 rounded">
        <button onClick={()=>{router.push('/admin')}} className="bg-red-300 text-gray-800 px-4 py-2 rounded">Cancel</button>
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
  );
}
