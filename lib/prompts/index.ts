import OpenAI from "openai";
import { Idea, IdeaBucket } from "../db/schema";

import "server-only";

export async function generateIdeaResponse(
  client: OpenAI,
  description: string,
) {
  return await client.chat.completions.create({
    model: "gpt-6-astra",
    messages: [
      {
        role: "user",
        content: description,
      },
      {
        role: "system",
        content: `You are an idea goblin, that helps people stay grounded with their ideas.
             You will be given a description of an idea, and you will need to provide a category, type, and title for the idea.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "idea",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              minLength: 3,
              maxLength: 100,
            },
            category: {
              type: "string",
              minLength: 3,
              maxLength: 100,
            },
            type: {
              type: "string",
              minLength: 3,
              maxLength: 100,
            },
          },
          required: ["title", "category", "type"],
          additionalProperties: false,
        },
      },
    },
    reasoning_effort: "medium",
  });
}

export async function findRelevantBucket(
  client: OpenAI,
  buckets: IdeaBucket[],
  idea: Idea,
) {
  return await client.chat.completions.create({
    model: "gpt-6-astra",
    messages: [
      {
        role: "system",
        content: `
            You classify a user's new idea into an existing idea bucket.
  
            A bucket represents a broader project, product, or concept that multiple related ideas may belong to.
  
            Your goal is to determine whether the new idea is meaningfully part of one of the existing buckets.
  
            Rules:
            - Prefer an existing bucket when the idea is a feature, extension, variation, or closely related concept within that bucket.
            - Do NOT match based only on superficial words, category, or type.
            - Consider the underlying purpose, target user, problem being solved, and product/project context.
            - Do NOT force an idea into an existing bucket when the relationship is weak.
            - If multiple buckets are relevant, choose the single most relevant bucket.
            - If no existing bucket is sufficiently relevant, recommend creating a new bucket.
            - Never invent an ID for a new bucket.
            - relevanceScore represents confidence that the idea belongs to the selected existing bucket.
            - A new bucket should have a concise name and description representing the broader concept, not merely repeat the idea's title.
                    `.trim(),
      },
      {
        role: "user",
        content: `
            NEW IDEA
  
            Title: ${idea.title}
            Type: ${idea.type}
            Category: ${idea.category}
            Description: ${idea.description}
  
            EXISTING BUCKETS
  
            ${buckets
              .map(
                (bucket) => `
            ID: ${bucket.id}
            Name: ${bucket.name}
            Description: ${bucket.description}
            `,
              )
              .join("\n")}
                    `.trim(),
      },
    ],

    response_format: {
      type: "json_schema",
      json_schema: {
        name: "bucket_classification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["use_existing", "create_new"],
            },

            bucketId: {
              type: ["integer", "null"],
            },

            relevanceScore: {
              type: "number",
              minimum: 0,
              maximum: 100,
            },

            newBucketName: {
              type: ["string", "null"],
            },

            newBucketDescription: {
              type: ["string", "null"],
            },

            reasoning: {
              type: "string",
              maxLength: 300,
            },
          },

          required: [
            "action",
            "bucketId",
            "relevanceScore",
            "newBucketName",
            "newBucketDescription",
            "reasoning",
          ],

          additionalProperties: false,
        },
      },
    },

    reasoning_effort: "medium",
  });
}
