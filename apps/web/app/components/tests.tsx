export function TestCase() {
    return (
        <div className="mb-2">
        <label className="text-xl border-2 border-gray-800 rounded-md m-2 p-2 w-lg">
          <span className="text-lg">Input</span>
          <input type="text" placeholder="arg1, arg2" className="m-2" />
        </label>
        <label className="text-xl border-2 border-gray-800 rounded-md m-2 p-2 w-lg">
          <span className="text-lg">Output</span>
          <input type="text" placeholder="arg1, arg2" className="m-2" />
        </label>
        
      </div>
      
    )
}