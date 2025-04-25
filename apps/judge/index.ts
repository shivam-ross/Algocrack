// bun-ws-server.ts
import { WebSocketServer, WebSocket as WSWebSocket } from "ws";
import { writeFile, mkdir, rm, access } from "fs/promises";
import { randomUUID } from "crypto";
import { exec } from "child_process";
import { constants } from "fs";

import { prisma } from "db";
import { jwtVerify, importJWK, type JWK } from 'jose';
import type { string } from "zod";
import type { $Enums, Languages } from "@prisma/client";

// --- Configuration ---
const key: JWK = JSON.parse(process.env.JWT_SIGNING_KEY!);
const DOCKER_TIMEOUT_MS = 10000;
const TEMP_DIR_BASE = "./tmp"; // Use a directory within the project instead of /tmp

if (!key) {
    console.error("FATAL: JWT_SIGNING_KEY environment variable is not set.");
    process.exit(1);
}

// --- Authentication ---
async function verifyToken(token: string): Promise<any> {
    try {
        return await jwtVerify(token, await importJWK(key, 'HS512'), {
            algorithms: ['HS512']
        });
    } catch (error) {
        console.error("Token verification failed:", error);
        return null;
    }
}

// --- Type Definition for Problem Args ---
type ProblemArg = {
    name: string;
    type: string;
};

// --- Type Mappings for Parsing and Serialization ---
interface TypeInfo {
    jsType: string;
    cppType: string;
    pythonType: string;
    parseInput: (value: string, lang: string) => string;
    parseOutput: (value: string) => any;
}

const typeMappings: Record<string, TypeInfo> = {
    number: {
        jsType: "number",
        cppType: "int",
        pythonType: "int",
        parseInput: (value, lang) => value.trim(),
        parseOutput: (value) => {
            const trimmed = value.trim();
            const num = parseInt(trimmed);
            if (isNaN(num)) throw new Error(`Invalid number output: ${trimmed}`);
            return num;
        },
    },
    string: {
        jsType: "string",
        cppType: "string",
        pythonType: "str",
        parseInput: (value, lang) => lang === "cpp" ? `"${value.trim()}"` : value.trim(),
        parseOutput: (value) => value.trim().replace(/^"|"$/g, ""),
    },
    "List[int]": {
        jsType: "Array<number>",
        cppType: "vector<int>",
        pythonType: "list",
        parseInput: (value, lang) => {
            const clean = value.trim().replace(/^\[|\]$/g, '').split(',').map(v => v.trim()).join(',');
            if (lang === "cpp") return `{${clean}}`;
            return `[${clean}]`;
        },
        parseOutput: (value) => {
            const clean = value.trim().replace(/^\[|\]$/g, '').split(',').map(v => parseInt(v.trim()));
            return clean;
        },
    },
    bool: {
        jsType: "boolean",
        cppType: "bool",
        pythonType: "bool",
        parseInput: (value, lang) => value.trim().toLowerCase(),
        parseOutput: (value) => value.trim().toLowerCase() === "true",
    },
};

function getTypeInfo(type: string): TypeInfo {
    const typeInfo = typeMappings[type];
    if (!typeInfo) throw new Error(`Unsupported type: ${type}`);
    return typeInfo;
}

// --- Job Queue ---
type Job = {
    userId: string;
    lang: string;
    code: string;
    problemId: string;
    ws: WSWebSocket;
};

const queue: Job[] = [];
let running = false;

// Extend WebSocket type for user payload
interface AuthenticatedWebSocket extends WSWebSocket {
    user?: { id: string; name?: string; email?: string };
}

// --- WebSocket Server ---
const wss = new WebSocketServer({ port: 8080 });

console.log("WebSocket server starting on ws://localhost:8080");

wss.on("connection", async (ws: AuthenticatedWebSocket, req) => {
    console.log("Client connected");
    const params = new URLSearchParams(req.url?.split("?")[1] || "");
    const token = params.get("token");

    const user = await verifyToken(token || "");
    if (!user || !user.payload?.id) {
        console.log("Connection attempt with invalid token");
        ws.close(1008, "Invalid token");
        return;
    }

    ws.user = user.payload;
    console.log(`User ${user.payload.id} connected`);

    ws.on("message", async (data) => {
        if (!ws.user) return;

        try {
            const message = JSON.parse(data.toString());
            if (!message.lang || !message.code || !message.problemId) {
                ws.send(JSON.stringify({ error: "Invalid message format", detail: "Missing lang, code, or problemId" }));
                return;
            }
            const { lang, code, problemId } = message;

            console.log(`Job received from ${ws.user.id}: lang=${lang}, problemId=${problemId}`);
            queue.push({ userId: ws.user.id, lang, code, problemId, ws });
            processQueue();
        } catch (err) {
            console.error("Failed to parse message or queue job:", err);
            ws.send(JSON.stringify({ error: "Invalid message format", detail: "Could not parse JSON" }));
        }
    });

    ws.on("close", (code, reason) => {
        console.log(`Client disconnected: ${ws.user?.id || 'unknown'} (Code: ${code}, Reason: ${reason || 'none'})`);
    });

    ws.on("error", async (error) => {
        console.error(`WebSocket error for ${ws.user?.id || 'unknown'}:`, error);
        if (ws.readyState === WSWebSocket.OPEN || ws.readyState === WSWebSocket.CONNECTING) {
            ws.close(1011, "WebSocket error occurred");
        }
    });
});

// --- Job Processing Logic ---
async function processQueue() {
    if (running || queue.length === 0) {
        return;
    }

    running = true;
    const job = queue.shift()!;
    const { lang, code, problemId, ws, userId } = job;
    let submission = null;

    try {
        submission = await prisma.submission.create({
            data: {
                code,
                problemId,
                userId,
                language: lang.toUpperCase() as Languages,
                status: "PENDING",
            }
        });
        console.log(`Created submission ${submission.id} for job ${problemId}`);
    } catch (error) {
        console.error("Failed to create submission:", error);
        ws.send(JSON.stringify({ error: "Database Error", detail: "Failed to create submission in database." }));
        running = false;
        processQueue();
        return;
    }

    if (ws.readyState !== WSWebSocket.OPEN) {
        console.log(`User ${userId} disconnected before job ${problemId} could start.`);
        running = false;
        processQueue();
        return;
    }

    const id = randomUUID();
    const dir = `${TEMP_DIR_BASE}/code-${id}`;

    let filename = "";
    let compileCmd = "";
    let executeCmd = "";
    let dockerfile = "";

    switch (lang) {
        case "cpp":
            filename = "main.cpp";
            compileCmd = "g++ main.cpp -o main -O2 -std=c++17";
            executeCmd = "./main";
            dockerfile = "cpp";
            break;
        case "python":
            filename = "main.py";
            executeCmd = `python3 main.py`;
            dockerfile = "py";
            break;
        case "javascript":
            filename = "main.js";
            executeCmd = `node main.js`;
            dockerfile = "js";
            break;
        default:
            console.log(`Unsupported language requested: ${lang}`);
            ws.send(JSON.stringify({ error: "Unsupported language", detail: `Language '${lang}' is not supported.` }));
            await prisma.submission.update({
                where: { id: submission.id },
                data: { status: "RUNTIME_ERROR" }
            });
            running = false;
            processQueue();
            return;
    }

    const dockerImageTag = `runner-${id}`;
    const buildCmd = `docker build -f docker/${dockerfile}.dockerfile -t ${dockerImageTag} ${dir}`;

    console.log(`Processing job ${id} for user ${userId} in ${dir}`);

    try {
        // Create directory with explicit permissions
        console.log(`Creating directory ${dir}...`);
        await mkdir(dir, { recursive: true, mode: 0o777 });
        console.log(`Directory ${dir} created.`);

        // Verify directory exists
        await access(dir, constants.R_OK | constants.W_OK);
        console.log(`Directory ${dir} is accessible.`);

        // Verify Dockerfile exists
        await access(`docker/${dockerfile}.dockerfile`, constants.R_OK);
        console.log(`Dockerfile docker/${dockerfile}.dockerfile found.`);

        const problem = await prisma.problem.findUnique({
            where: { id: problemId },
            select: { functionName: true, args: true, returnType: true }
        });
        if (!problem) {
            console.log(`Problem with ID ${problemId} not found.`);
            ws.send(JSON.stringify({ error: "Problem Not Found", detail: `Problem with ID ${problemId} not found.` }));
            await prisma.submission.update({
                where: { id: submission.id },
                data: { status: "RUNTIME_ERROR" }
            });
            return;
        }
        const { functionName, args, returnType } = problem;

        const validatedArgs: ProblemArg[] = args.map((arg, index) => {
            if (typeof arg !== 'object' || arg === null || !('name' in arg) || !('type' in arg)) {
                throw new Error(`Invalid arg at index ${index}: Expected object with name and type`);
            }
            return { name: String(arg.name), type: String(arg.type) };
        });

        let finalCode = '';
        const inputArgs = validatedArgs.map(arg => arg.name).join(', ');

        let sanitizedCode = '';
        switch (lang) {
            case "javascript":
                sanitizedCode = code.trim().replace(/;+\s*$/, '');
                finalCode = `${sanitizedCode}
process.stdin.setEncoding('utf8');
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    try {
        const args = {};
        const inputs = input.trim().split('\\n');
        if (inputs.length < ${validatedArgs.length}) {
            throw new Error('Insufficient input lines: expected ${validatedArgs.length}, got ' + inputs.length);
        }
        ${validatedArgs.map((arg, i) => {
            const typeInfo = getTypeInfo(arg.type);
            if (typeInfo.jsType === "number") {
                return `args["${arg.name}"] = parseInt(inputs[${i}]); if (isNaN(args["${arg.name}"])) throw new Error("Invalid number input: " + inputs[${i}]);`;
            } else if (typeInfo.jsType === "string") {
                return `args["${arg.name}"] = String(inputs[${i}]).trim().replace(/^"|"$/g, "");`;
            } else if (typeInfo.jsType === "Array<number>") {
                return `args["${arg.name}"] = inputs[${i}].trim().replace(/^\[|\]$/g, '').split(',').map(v => parseInt(v.trim()));`;
            } else if (typeInfo.jsType === "boolean") {
                return `args["${arg.name}"] = inputs[${i}].trim().toLowerCase() === "true";`;
            }
            return `args["${arg.name}"] = inputs[${i}];`;
        }).join('\n')}
        let result = ${functionName}(${validatedArgs.map(arg => `args["${arg.name}"]`).join(', ')});
        if (typeof result === 'function') {
            result = result(${validatedArgs.map(arg => `args["${arg.name}"]`).join(', ')});
        }
        ${getTypeInfo(returnType).jsType === "number"
            ? `console.log(String(result));`
            : getTypeInfo(returnType).jsType === "string"
                ? `console.log(String(result).trim());`
                : getTypeInfo(returnType).jsType === "Array<number>"
                    ? `console.log('[' + result.map(String).join(',') + ']');`
                    : getTypeInfo(returnType).jsType === "boolean"
                        ? `console.log(result.toString());`
                        : `console.log(result);`}
    } catch (err) {
        console.error('Execution error:', err.message);
        process.exit(1);
    }
});
`;
                console.log(`JavaScript finalCode for job ${id}:\n`, finalCode);
                break;

            case "python":
                sanitizedCode = code
                    .split('\n')
                    .map(line => line.replace(/\t/g, '    ').trimEnd())
                    .filter(line => line.trim() !== '')
                    .join('\n');
                finalCode = `${sanitizedCode}
import sys

if __name__ == "__main__":
    inputs = sys.stdin.read().strip().split('\\n')
    try:
        args = {}
${validatedArgs.map((arg, i) => {
                    const typeInfo = getTypeInfo(arg.type);
                    if (typeInfo.pythonType === "int") {
                        return `        args["${arg.name}"] = int(inputs[${i}])`;
                    } else if (typeInfo.pythonType === "str") {
                        return `        args["${arg.name}"] = str(inputs[${i}]).strip().replace('"', '')`;
                    } else if (typeInfo.pythonType === "list") {
                        return `        args["${arg.name}"] = [int(x) for x in inputs[${i}].strip().replace('[', '').replace(']', '').split(',')]`;
                    } else if (typeInfo.pythonType === "bool") {
                        return `        args["${arg.name}"] = inputs[${i}].strip().lower() == 'true'`;
                    }
                    return `        args["${arg.name}"] = inputs[${i}]`;
                }).join('\n')}
        result = ${functionName}(${validatedArgs.map(arg => `args["${arg.name}"]`).join(', ')})
${getTypeInfo(returnType).pythonType === "int"
                    ? `        print(str(result))`
                    : getTypeInfo(returnType).pythonType === "str"
                        ? `        print(str(result).strip())`
                        : getTypeInfo(returnType).pythonType === "list"
                            ? `        print(','.join(map(str, result)))`
                            : getTypeInfo(returnType).pythonType === "bool"
                                ? `        print(str(result).lower())`
                                : `        print(result)`}
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)
`;
                const numberedFinalCode = finalCode
                    .split('\n')
                    .map((line, i) => `${(i + 1).toString().padStart(4, ' ')} | ${line}`)
                    .join('\n');
                console.log(`Python finalCode for job ${id}:\n${numberedFinalCode}`);
                break;

            case "cpp":
                const cppArgTypes = validatedArgs.map(arg => `${getTypeInfo(arg.type).cppType} ${arg.name}`).join(', ');
                const parseInputs = validatedArgs.map(arg => {
                    const typeInfo = getTypeInfo(arg.type);
                    if (typeInfo.cppType === "vector<int>") {
                        return `
vector<int> ${arg.name};
string ${arg.name}_line;
getline(cin, ${arg.name}_line);
${arg.name}_line = ${arg.name}_line.substr(1, ${arg.name}_line.size() - 2);
stringstream ${arg.name}_ss(${arg.name}_line);
int ${arg.name}_val;
while (${arg.name}_ss >> ${arg.name}_val) {
    ${arg.name}.push_back(${arg.name}_val);
    if (${arg.name}_ss.peek() == ',') ${arg.name}_ss.ignore();
}`;
                    } else if (typeInfo.cppType === "int") {
                        return `int ${arg.name}; cin >> ${arg.name}; cin.ignore(numeric_limits<streamsize>::max(), '\\n');`;
                    } else if (typeInfo.cppType === "string") {
                        return `string ${arg.name}; getline(cin, ${arg.name});`;
                    } else if (typeInfo.cppType === "bool") {
                        return `bool ${arg.name}; string ${arg.name}_str; getline(cin, ${arg.name}_str); ${arg.name} = (${arg.name}_str == "true");`;
                    }
                }).join('\n');

                finalCode = `#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <limits>
using namespace std;

${code}

int main() {
    ${parseInputs}
    auto result = ${functionName}(${inputArgs});
    ${getTypeInfo(returnType).cppType === "int"
        ? `cout << result << endl;`
        : getTypeInfo(returnType).cppType === "string"
            ? `cout << result << endl;`
            : getTypeInfo(returnType).cppType === "vector<int>"
                ? `cout << "{" << result[0]; for (size_t i = 1; i < result.size(); ++i) cout << "," << result[i]; cout << "}" << endl;`
                : getTypeInfo(returnType).cppType === "bool"
                    ? `cout << (result ? "true" : "false") << endl;`
                    : `cout << result << endl;`}
    return 0;
}`;
                break;
        }

        // Write files and verify
        console.log(`Writing ${filename} to ${dir}...`);
        await writeFile(`${dir}/${filename}`, finalCode);
        await access(`${dir}/${filename}`, constants.R_OK | constants.W_OK);
        console.log(`${filename} written successfully.`);

        const runShContent = `#!/bin/sh
set -e

${compileCmd ? `${compileCmd}` : ""}

${executeCmd} < /app/input.txt
`;
        console.log(`Writing run.sh to ${dir}...`);
        await writeFile(`${dir}/run.sh`, runShContent);
        await access(`${dir}/run.sh`, constants.R_OK | constants.W_OK);
        console.log(`run.sh written successfully.`);

        console.log(`Setting executable permissions for run.sh...`);
        await execPromise(`chmod +x ${dir}/run.sh`);
        console.log(`Permissions set for run.sh.`);

        console.log(`Building docker image ${dockerImageTag}...`);
        await execPromise(buildCmd, 60000);
        console.log(`Docker image ${dockerImageTag} built.`);

        const testCases = await prisma.testCase.findMany({
            where: { problemId }
        });

        if (testCases.length === 0) {
            console.log(`No test cases found for problem ${problemId}`);
            ws.send(JSON.stringify({ error: "No Test Cases", detail: "No test cases configured for this problem." }));
            await prisma.submission.update({
                where: { id: submission.id },
                data: { status: "RUNTIME_ERROR" }
            });
            return;
        }

        console.log(`Running ${testCases.length} test cases for job ${id}...`);

        let allPassed = true;
        for (let i = 0; i < testCases.length; i++) {
            if (ws.readyState !== WSWebSocket.OPEN) {
                console.log(`User ${userId} disconnected during test case execution for job ${id}.`);
                allPassed = false;
                break;
            }
            const { input, output: expectedOutput } = testCases[i];
            const testCaseNum = i + 1;

            let inputLines: string[];
            try {
                console.log(`Test case ${testCaseNum} input:`, input);
                console.log(`Expected args count: ${validatedArgs.length}`, validatedArgs);
                if (!input || input.trim() === '') {
                    throw new Error("Input is empty or null");
                }
                inputLines = input.includes(',')
                    ? input.split(',').map(line => line.trim()).filter(line => line !== '')
                    : input.includes('\n')
                        ? input.split('\n').map(line => line.trim()).filter(line => line !== '')
                        : [input.trim()];
                if (inputLines.length !== validatedArgs.length) {
                    throw new Error(`Input args count mismatch: Expected ${validatedArgs.length} args, got ${inputLines.length} values`);
                }
                inputLines = inputLines.map((line, idx) => {
                    if (idx >= validatedArgs.length) throw new Error("Too many input values");
                    if (line === '') {
                        throw new Error(`Input value ${idx + 1} is empty`);
                    }
                    const parsed = getTypeInfo(validatedArgs[idx].type).parseInput(line, lang);
                    console.log(`Parsed input ${idx + 1}:`, parsed);
                    return parsed;
                });
                console.log(`Writing to input.txt:`, inputLines.join('\n'));
            } catch (err) {
                console.error(`Invalid input for test case ${testCaseNum}:`, err);
                ws.send(JSON.stringify({
                    error: "Invalid Test Case Input",
                    detail: `${err instanceof Error ? err.message : 'Unknown error'} (Input: ${JSON.stringify(input)}, Expected args: ${JSON.stringify(validatedArgs.map(arg => arg.name))})`
                }));
                await prisma.submission.update({
                    where: { id: submission.id },
                    data: { status: "RUNTIME_ERROR" }
                });
                allPassed = false;
                break;
            }
            console.log(`Writing input.txt to ${dir}...`);
            await writeFile(`${dir}/input.txt`, inputLines.join('\n'));
            await access(`${dir}/input.txt`, constants.R_OK | constants.W_OK);
            console.log(`input.txt written successfully.`);

            const runDockerCmd = `docker run --rm --network none -v "${dir}":/app --workdir /app ${dockerImageTag} sh /app/run.sh`;

            let actualOutput = "";
            let passed = false;
            let testCaseError: { type: $Enums.SubmissionStatus | null; detail: string } = { type: null, detail: "" };

            try {
                console.log(`Running test case ${testCaseNum}/${testCases.length} for job ${id}`);
                actualOutput = await execPromise(runDockerCmd, DOCKER_TIMEOUT_MS);
                const typeInfo = getTypeInfo(returnType);
                const cleanActualOutput = typeInfo.parseOutput(actualOutput.trim());
                const cleanExpectedOutput = typeInfo.parseOutput(expectedOutput.trim());

                console.log(`Test case ${testCaseNum} actualOutput:`, cleanActualOutput);
                console.log(`Test case ${testCaseNum} expectedOutput:`, cleanExpectedOutput);

                passed = JSON.stringify(cleanActualOutput) === JSON.stringify(cleanExpectedOutput);
                console.log(`Test case ${testCaseNum}: ${passed ? 'Passed' : 'Failed'}`);
            } catch (execError: any) {
                console.error(`Test case ${testCaseNum} failed for job ${id}:`, execError);
                passed = false;
                allPassed = false;
                const errorDetail = execError.stderr || execError.message || "Unknown error during execution.";
                if (execError.message.includes('ETIMEDOUT') || execError.message.includes('killed')) {
                    testCaseError = { type: "TIME_LIMIT_EXCEEDED", detail: `Execution timed out after ${DOCKER_TIMEOUT_MS / 1000} seconds.` };
                } else if (errorDetail.includes('g++') || (lang === 'cpp' && errorDetail.toLowerCase().includes('error:')) || (lang === 'python' && (errorDetail.toLowerCase().includes('syntaxerror') || errorDetail.toLowerCase().includes('indentationerror')))) {
                    testCaseError = { type: "COMPILE_ERROR", detail: `Code failed to compile: ${errorDetail}` };
                } else {
                    testCaseError = { type: "RUNTIME_ERROR", detail: `Execution failed: ${errorDetail}` };
                }

                await prisma.submittedTestCase.create({
                    data: {
                        submissionId: submission.id,
                        status: testCaseError?.type as $Enums.SubmissionStatus || "RUNTIME_ERROR",
                        input,
                        expectedOutput,
                        output: actualOutput
                    }
                });

                await prisma.submission.update({
                    where: { id: submission.id },
                    data: { status: testCaseError?.type || "WRONG_ANSWER" }
                });

                ws.send(JSON.stringify({
                    testCase: testCaseNum,
                    input,
                    expected: expectedOutput,
                    error: testCaseError
                }));
                break;
            }

            if (ws.readyState === WSWebSocket.OPEN) {
                await prisma.submittedTestCase.create({
                    data: {
                        submissionId: submission.id,
                        status: passed ? "ACCEPTED" : "WRONG_ANSWER",
                        input,
                        expectedOutput,
                        output: actualOutput
                    }
                });
                ws.send(JSON.stringify({
                    testCase: testCaseNum,
                    input,
                    expected: expectedOutput,
                    actual: actualOutput.trim(),
                    passed,
                }));
            }

            if (!passed) {
                await prisma.submission.update({
                    where: { id: submission.id },
                    data: { status: passed ? "ACCEPTED" : "WRONG_ANSWER" }
                });
                allPassed = false;
                break;
            }
        }

        if (allPassed && ws.readyState === WSWebSocket.OPEN) {
            await prisma.submission.update({
                where: { id: submission.id },
                data: { status: "ACCEPTED" }
            });
            ws.send(JSON.stringify({ status: "All test cases passed!" }));
            console.log(`Job ${id} for user ${userId} completed successfully.`);
        } else if (!allPassed) {
            console.log(`Job ${id} for user ${userId} failed on a test case.`);
        }

    } catch (err: any) {
        console.error(`Critical error processing job ${id} for user ${userId}:`, err);
        if (ws.readyState === WSWebSocket.OPEN) {
            let clientError = "Internal Server Error";
            let detail = "An unexpected error occurred on the server.";

            if (err.message?.includes('docker build')) {
                clientError = "Build Error";
                detail = `Failed to build the execution environment: ${err.message}. Check Dockerfile or server setup.`;
            } else if (err.code === 'ENOENT') {
                clientError = "File System Error";
                detail = `Server encountered a file system issue: ${err.message}`;
            }
            await prisma.submission.update({
                where: { id: submission.id },
                data: { status: "RUNTIME_ERROR" }
            });
            ws.send(JSON.stringify({ error: clientError, detail: detail }));
        }
    } finally {
        console.log(`Cleaning up resources for job ${id}...`);
        await execPromise(`docker rmi ${dockerImageTag}`)
            .then(() => console.log(`Removed docker image ${dockerImageTag}`))
            .catch(err => console.error(`Failed to remove docker image ${dockerImageTag}:`, err?.message || err));
        await rm(dir, { recursive: true, force: true })
            .then(() => console.log(`Removed temp directory ${dir}`))
            .catch(err => console.error(`Failed to remove temp directory ${dir}:`, err));
        running = false;
        console.log(`Finished processing job ${id}. Triggering next queue check.`);
        processQueue();
    }
}

// --- Utility: Execute Shell Commands ---
function execPromise(cmd: string, timeout: number = DOCKER_TIMEOUT_MS): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, { timeout: timeout }, (err, stdout, stderr) => {
            if (err) {
                const error = new Error(err.message);
                (error as any).stderr = stderr || 'No stderr available';
                (error as any).stdout = stdout || '';
                console.error(`Command failed: ${cmd}\nError: ${err.message}\nStderr: ${stderr}\nStdout: ${stdout}`);
                return reject(error);
            }
            if (stderr) {
                console.warn(`Command succeeded but produced stderr: ${cmd}\nStderr: ${stderr}`);
            }
            resolve(stdout);
        });
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down WebSocket server...');
    wss.close((err: any) => {
        if (err) {
            console.error('Error closing WebSocket server:', err);
        } else {
            console.log('WebSocket server closed.');
        }
        process.exit(err ? 1 : 0);
    });
});