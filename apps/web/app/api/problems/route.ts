import { prisma } from "db";
import { cookies } from "next/headers";
import bcrypt from "bcrypt";
import { ProlemCreateSchema } from "../../../lib/zodSchema";
import { NextRequest } from "next/server";
import { generateBoilerplate } from "../../../lib/boilerplate";


export async function GET() {
    try{
        const res = await prisma.problem.findMany({});
        return new Response(JSON.stringify(res), {status: 200});
    } catch (error) {
        console.error("Error fetching problems:", error);
        return new Response("Failed to fetch problems", { status: 500 });
    }
}

export async function POST (request: NextRequest) {
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

    try{
        const { title, description, difficulty, tags, testCases, args, returnType, functionName } = schemaSuccess.data;
        const languages = generateBoilerplate(functionName, args, returnType);
        
        const problem = await prisma.problem.create({
            data: {
                title,
                description,
                difficulty,
                args,
                returnType,
                functionName,
                tags: tags|| " ",
                testCases: {
                    create: testCases
                },
                languages: {
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
        return new Response(JSON.stringify(problem), {status: 200});
    } catch (error) {
        console.error("Error creating problem:", error);
        return new Response("Failed to create problem", { status: 500 });
    }
}



  