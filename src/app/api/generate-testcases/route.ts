import OpenAI from 'openai';
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { story, testPlan, testcasePrompt, llmProvider, llmApiKey } = body;

    if (!story) return NextResponse.json({ error: "Story/Requirements data is required" }, { status: 400 });
    if (!testPlan) return NextResponse.json({ error: "Test Plan is required to generate test cases" }, { status: 400 });
    if (!llmApiKey) return NextResponse.json({ error: "LLM API Key is required" }, { status: 401 });

    let systemPrompt = `You are a world-class QA Automation Architect expert in BDD, Gherkin, and exhaustive test generation.

Your task is to generate professional, exhaustive BDD test cases in raw JSON format based on the provided Requirements and Test Plan.
Do NOT wrap your response in markdown tags (like \`\`\`json). The output must start with { and end with }.

JSON SCHEMA REQUIREMENT:
You MUST return a JSON object with exactly ONE key named "testCases".
The value of "testCases" MUST be an array of objects.
Each object in the array MUST have the following structure:
{
  "id": "A unique identifier like TC-01",
  "title": "A clear, descriptive title of the test scenario",
  "priority": "High", "Medium", or "Low",
  "type": "Must be exactly 'BDD'",
  "category": "One of: Smoke, Functional, Negative, Edge, Security, Performance, UI",
  "steps": [
    "Given ...",
    "When ...",
    "Then ..."
  ]
}

CRITICAL EXHAUSTIVE COVERAGE RULE:
UNLESS the user explicitly restricts the scope in the Custom Instructions, you MUST generate an EXHAUSTIVE suite of test cases covering ALL of the following categories by default:
1. Smoke / Sanity tests
2. Functional (Positive / Happy Path)
3. Negative / Validation (Invalid inputs, missing data, incorrect formats)
4. Edge Cases (Boundary values like 0, -1, max limits, leading zeros, empty strings)
5. Security (SQL Injection, XSS, Path Traversal, broken auth - use concrete injection strings)
6. Non-Functional / Performance (Response times, payload sizes)

TEST DATA RULE:
- Always use concrete, realistic test data in your 'Examples' tables instead of generic placeholders.
- Provide actual SQL injection strings (e.g., '1 OR 1=1'), XSS scripts (e.g., '<script>alert(1)</script>'), and concrete invalid data (e.g., '!@#', 'abc').
- If the user provides specific valid or invalid test data in the custom instructions, you MUST prioritize and include their data in your scenarios.
`;

    if (story.source?.toLowerCase() === 'swagger') {
       systemPrompt += `\n\nAPI/SWAGGER SPECIFIC INSTRUCTIONS:
1. Ensure the 'When' steps explicitly mention the HTTP method (GET, POST, PUT, DELETE) and the precise endpoint path.
2. Ensure the 'Then' steps explicitly validate the exact HTTP status codes (200, 201, 400, 401, 403, 404, 500).
3. If path parameters exist (e.g., /pet/{petId}), generate boundary and invalid boundary tests for that specific parameter.
4. Use Scenario Outlines heavily to iterate through multiple HTTP response scenarios.
Example formatting for API test steps:
"Given the API base URL is configured",
"When I send a GET request to '/pet/<petId>'",
"Then the response status code should be <statusCode>",
"Examples:",
"| petId |",
"| 1     |",
"| 999   |"`;
    } else {
       systemPrompt += `\n\nUI/FUNCTIONAL SPECIFIC INSTRUCTIONS:
1. Focus on specific user actions, exact UI elements, and concrete assertions.
2. Incorporate explicit test data directly into the steps or Examples tables.
3. Explicitly test standard UI security/validation checks (like XSS in text inputs, SQL injection in search fields) using concrete injection strings.`;
    }

    const userPrompt = `Generate comprehensive BDD test cases based on the following context.

    Source Type: ${story.source?.toUpperCase() || "UNKNOWN"}

    === REQUIREMENTS ===
    ${typeof story.description === 'string' ? story.description : JSON.stringify(story.description, null, 2)}

    === TEST PLAN ===
    ${typeof testPlan === 'string' ? testPlan : JSON.stringify(testPlan, null, 2)}

    === CUSTOM INSTRUCTIONS (OVERRIDES DEFAULT BEHAVIOR) ===
    ${testcasePrompt ? testcasePrompt : "No restrictions."}

    Remember: Return ONLY valid JSON matching the schema. No markdown wrapping. Include concrete TEST DATA in Examples tables prioritizing any user-provided values.`;

    let generatedText = "";
    const provider = llmProvider || "groq";

    if (provider === "openai") {
      const openai = new OpenAI({ apiKey: llmApiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      generatedText = completion.choices[0]?.message?.content || "";
    }

    if (provider === "groq") {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + llmApiKey },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error?.message || "Failed to generate test cases from Groq");
      }

      const data = await res.json();
      generatedText = data.choices[0]?.message?.content || "";
    }

    const cleanContent = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
    let parsedJson;
    try {
      parsedJson = JSON.parse(cleanContent);
    } catch (e) {
      return NextResponse.json({ error: "The AI generated invalid JSON." }, { status: 500 });
    }

    if (!parsedJson.testCases || !Array.isArray(parsedJson.testCases)) {
      return NextResponse.json({ error: "The AI response did not contain a valid 'testCases' array." }, { status: 500 });
    }

    return NextResponse.json({ testCases: parsedJson.testCases });

  } catch (error: any) {
    console.error("Generate Test Cases Error:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 });
  }
}
