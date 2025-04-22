'use client'

interface AdminProblemProps {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  difficulty: string;
  setDifficulty: (value: string) => void;
  tags: string;
  setTags: (value: string) => void;
  testCases: { input: string; output: string }[];
  setTestCases: (value: { input: string; output: string }[]) => void;
  functionName: string;
  setFunctionName: (value: string) => void;
  returnType: string;
  setReturnType: (value: string) => void;
  args: { name: string; type: string }[];
  setArgs: (value: { name: string; type: string }[]) => void;
}

const argTypes = ["number", "number[]", "string", "string[]", "boolean", "any"] as const;
const returnTypes = [...argTypes];

export default function AdminProblem({
  title,
  setTitle,
  description,
  setDescription,
  difficulty,
  setDifficulty,
  tags,
  setTags,
  testCases,
  setTestCases,
  functionName,
  setFunctionName,
  returnType,
  setReturnType,
  args,
  setArgs,
}: AdminProblemProps) {
  
  return (
    <div>
    <input
    placeholder="Title"
    className="w-full p-2 border border-gray-400 rounded"
    value={title}
    onChange={(e) => setTitle(e.target.value)}
  />

  <textarea
    placeholder="Description"
    className="w-full p-2 border border-gray-400 rounded"
    rows={5}
    value={description}
    onChange={(e) => setDescription(e.target.value)}
  />

  <select
    className="w-full p-2 border border-gray-400 rounded"
    value={difficulty}
    onChange={(e) => setDifficulty(e.target.value)}
  >
    <option value="EASY">Easy</option>
    <option value="MEDIUM">Medium</option>
    <option value="HARD">Hard</option>
  </select>

  <input
    placeholder="Tags (comma separated)"
    className="w-full p-2 border border-gray-400 rounded"
    value={tags}
    onChange={(e) => setTags(e.target.value)}
  />

  <input
    placeholder="Function Name"
    className="w-full p-2 border border-gray-400 rounded"
    value={functionName}
    onChange={(e) => setFunctionName(e.target.value)}
  />

  <select
    className="w-full p-2 border border-gray-400 rounded"
    value={returnType}
    onChange={(e) => setReturnType(e.target.value as typeof returnTypes[number])}
  >
    {returnTypes.map(t => <option key={t}>{t}</option>)}
  </select>

  <div>
    <h3 className="font-bold text-lg mb-2">Function Arguments</h3>
    {args.map((arg, i) => (
      <div key={i} className="flex gap-2 mb-2">
        <input
          placeholder="arg name"
          value={arg.name}
          onChange={(e) => {
            const updated = [...args];
            if (updated[i]) {
              updated[i].name = e.target.value;
            }
            setArgs(updated);
          }}
          className="p-2 border border-gray-400 rounded w-1/2"
        />
        <select
          value={arg.type}
          onChange={(e) => {
            const updated = [...args];
            if (updated[i]) {
              updated[i].type = e.target.value as typeof argTypes[number];
            }
            setArgs(updated);
          }}
          className="p-2 border border-gray-400 rounded w-1/2"
        >
          {argTypes.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
    ))}
    <button
      onClick={() => setArgs([...args, { name: "", type: "number" }])}
      className="bg-blue-300 px-4 py-1 rounded"
    >Add Arg</button>
    {args.length > 1 && (
        <button
        onClick={() => setArgs(args.slice(0, -1))}
        className="bg-blue-300 px-4 py-1 rounded ml-2"
      >Remove Arg</button>
    )}
  </div>

  <div>
    <h3 className="font-bold text-lg mb-2">Test Cases</h3>
    {testCases.map((tc, i) => (
      <div key={i} className="flex flex-col gap-2 mb-4">
        <input
          placeholder="Input"
          value={tc.input}
          onChange={(e) => {
            const updated = [...testCases];
            if (updated[i]) {
              updated[i].input = e.target.value;
            }
            setTestCases(updated);
          }}
          className="p-2 border border-gray-400 rounded"
        />
        <input
          placeholder="Output"
          value={tc.output}
          onChange={(e) => {
            const updated = [...testCases];
            if (updated[i]) {
              updated[i].output = e.target.value;
            }
            setTestCases(updated);
          }}
          className="p-2 border border-gray-400 rounded"
        />
      </div>
    ))}
    <button
      onClick={() => setTestCases([...testCases, { input: "", output: "" }])}
      className="bg-blue-300 px-4 py-1 rounded"
    >Add Test Case</button>
    {testCases.length > 4 && (
        <button
        onClick={() => setTestCases(testCases.slice(0, -1))}
        className="bg-blue-300 px-4 py-1 rounded ml-2"
      >Remove Test Case</button>
    )}
  </div>
  </div>
  );
}
