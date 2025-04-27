import { prisma } from "db";
import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import { ProlemCreateSchema } from "../../../../lib/zodSchema";
import { NextRequest } from "next/server";
import { generateBoilerplate } from "../../../../lib/boilerplate";
import { $Enums, Prisma } from "@prisma/client";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } 
  ) {
    const { id } = await params;

    try {
        const problem = await prisma.problem.findUnique({
            where: {
                id: id,
            },
            include : {
                languages: true,
                testCases: true
            }
        });

        if (!problem) {
            return new Response("Problem not found", { status: 404 });
        }
        const res : {
            title: string;
            description: string;
            tags: string;
            difficulty: $Enums.Difficulty;
            functionName: string;
            returnType: string;
            args: Prisma.JsonValue[];
            testCases: {
                id: string;
                problemId: string;
                input: string;
                output: string;
            }[];
            boilerplate: {
                javascript: string;
                cpp: string;
                python: string;
            };
        } = {
            title: problem.title,
            description: problem.description,
            tags: problem.tags,
            difficulty: problem.difficulty,
            functionName: problem.functionName,
            returnType: problem.returnType,
            args: problem.args,
            testCases: problem.testCases,
            boilerplate: {
                javascript: problem.languages.find(lang => lang.name === "JAVASCRIPT")?.boilerplate || "",
                cpp: problem.languages.find(lang => lang.name === "CPP")?.boilerplate || "",
                python: problem.languages.find(lang => lang.name === "PYTHON")?.boilerplate || ""
            }
        };
        
        return new Response(JSON.stringify(res), { status: 200 });
    } catch (error) {
        console.error("Error fetching problem:", error);
        return new Response("Failed to fetch problem", { status: 500 });
    }
}

export async function PUT (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } 
  ) {
try {
    const cookieStore = await cookies();
    const adminKey = cookieStore.get('admin-key');
    if (!adminKey) return new Response("Unauthorized", { status: 401 });
  
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const success = await bcrypt.compare(adminKey.value, process.env.ADMIN_KEY_HASH!);
    if (!success) return new Response("Unauthorized", { status: 401 });
  
    const body = await request.json();
    const schemaSuccess = ProlemCreateSchema.safeParse(body);
    if (!schemaSuccess.success) {
      return new Response("Invalid data", { status: 400 });
    }
  
    const { id } = await params;
    const { title, description, difficulty, tags, testCases, args, returnType, functionName } = schemaSuccess.data;
            const languages = generateBoilerplate(functionName, args, returnType);
            
            const problem = await prisma.problem.update({
                where: {
                    id: id,
                },
                data: {
                    title,
                    description,
                    difficulty,
                    args,
                    returnType,
                    functionName,
                    tags: tags||"",
                    testCases: {
                        deleteMany: {
                            problemId: id,
                        },

                        create: testCases
                    },
                    languages: {
                        deleteMany: {
                            problemId: id,
                        },
                        create: [
                            {
                                name: "JAVASCRIPT",
                                boilerplate: languages.javascript,
                            },
                            {
                                name: "PYTHON",
                                boilerplate: languages.python,
                            },
                            {
                                name: "CPP",
                                boilerplate: languages.cpp,
                            },
                        ]
                    }
                }
            });
  
      await prisma.testCase.deleteMany({
        where: { problemId: id },
      });
  
     
      const createdTestCases = await prisma.testCase.createMany({
        data: testCases.map(tc => ({
          input: tc.input,
          output: tc.output,
          problemId: id,
        })),
      });
  
      return new Response(JSON.stringify({ problem, createdTestCases }), { status: 200 });
} catch (error) {
      console.error(error);
      return new Response("Something went wrong", { status: 500 });
    }
  }
  
  export async function DELETE (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } 
  ) {
    const cookieStore = await cookies();
    const adminKey = cookieStore.get('admin-key');
    if (!adminKey) return new Response("Unauthorized", { status: 401 });
  
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const success = await bcrypt.compare(adminKey.value, process.env.ADMIN_KEY_HASH!);
    if (!success) return new Response("Unauthorized", { status: 401 });
    const { id } = await params;
    try {
        const problem = await prisma.problem.delete({
            where: {
                id: id,
            },
        });
        if (!problem) {
            return new Response("Problem not found", { status: 404 });
        }
        return new Response(JSON.stringify(problem), { status: 200 });
    }
    catch (error) {
        console.error("Error deleting problem:", error);
        return new Response("Failed to delete problem", { status: 500 });
    }
  }
