type Argument = {
    name: string;
    type: "string" | "number" | "boolean" | "number[]" | "string[]" | "any";
  };
  
  type ReturnType = "string" | "number" | "boolean" | "number[]" | "string[]" | "any";
  
  export function generateBoilerplate(
    functionName: string,
    args: Argument[],
    returnType: ReturnType
  ) {
    const jsArgs = args.map(arg => arg.name).join(", ");
    const pythonArgs = args.map(arg => arg.name).join(", ");
    
    const cppArgTypeMap: Record<Argument["type"], string> = {
      number: "int",
      "number[]": "vector<int>",
      string: "string",
      "string[]": "vector<string>",
      boolean: "bool",
      any: "auto",
    };
  
    const cppArgs = args.map(arg => `${cppArgTypeMap[arg.type]} ${arg.name}`).join(", ");
  
    const cppReturnMap: Record<ReturnType, string> = {
      number: "int",
      "number[]": "vector<int>",
      string: "string",
      "string[]": "vector<string>",
      boolean: "bool",
      any: "auto",
    };
  
    return {
      javascript: `function ${functionName}(${jsArgs}) {
    // Write your code here
  }`,
      python: `def ${functionName}(${pythonArgs}):
      # Write your code here`,
      cpp: `#include <vector>
  #include <string>
  using namespace std;
  
  ${cppReturnMap[returnType]} ${functionName}(${cppArgs}) {
      // Write your code here
  }
  `
    };
  }
