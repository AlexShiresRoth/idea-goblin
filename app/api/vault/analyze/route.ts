import { AuthGuard } from "@/lib/auth/auth-guard";
import { NextResponse } from "next/server";

import { OpenAI } from "openai";
const client = new OpenAI();

async function streamAnalysis(pathway: string) { 
    const stream = await client.responses.create({
        model: "gpt-6-astra",
        input: [
          {
            role: "user",
            content: ,
          },
        ],
        stream: true,
      });
      
      for await (const event of stream) {
        console.log(event);
      }
}

type Pathway = "analysis" | "execution" | "refinement";

// TODO : Analysis could produce a vault-level report/visualization, 
// Execution could produce a ranked shortlist with “pursue / park / kill,” and Refinement could produce specific ideas with suggested branches.
export async function POST(request: Request) {
  try {
    const session = await AuthGuard();

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { pathway } = await request.json() as { pathway: Pathway };

    if (!pathway) {
      return new Response("Bad Request", { status: 400 });
    }

    // switch(pathway) {
    //     case 'analysis' :

    //  }

    return NextResponse.json({ message: "Analysis started" });
  } catch (error) {
    console.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
