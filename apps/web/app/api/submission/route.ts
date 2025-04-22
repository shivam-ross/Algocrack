import { getServerSession } from "next-auth";
import { NEXT_AUTH_CONFIG } from "../../../lib/auth";
import { prisma } from "db";
import { Languages, SubmissionStatus } from "@prisma/client";

interface sub {
  id: string,
  status: SubmissionStatus,
  language: Languages,
  problemId: string,
  problem : {
    title: string
  }
}

export async function GET() {
  const session = await getServerSession(NEXT_AUTH_CONFIG);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const submissions = await prisma.submission.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        problem: {
          select: {
            title: true, // only fetch the problem name
          },
        },
      },
    });

    // Transform the result to include `problemName` instead of `problemId`
    const formatted = submissions.map((sub : sub) => ({
      id: sub.id,
      status: sub.status,
      language: sub.language,
      problemName: sub.problem.title,
    }));

    return new Response(JSON.stringify(formatted), { status: 200 });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return new Response("Failed to fetch submissions", { status: 500 });
  }
}
