
import z from "zod";

export const ProlemBodySchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string()).optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    testCases: z.array(
        z.object({
            input: z.string(),
            output: z.string(),
        })
    ).min(4)
})

export const ProlemCreateSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    tags: z.string().optional(),
    functionName: z.string().min(1),
    returnType: z.enum(["number", "number[]", "string", "string[]", "boolean", "any"]),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    testCases: z.array(
        z.object({
            input: z.string(),
            output: z.string(),
        })
    ).min(4),
    args: z.array(
        z.object({
            name: z.string().min(1),
            type: z.enum(["number", "number[]", "string", "string[]", "boolean", "any"]),
        })
    ).min(1)
});