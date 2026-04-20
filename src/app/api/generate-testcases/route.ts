import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { story, testPlan, testcasePrompt, llmProvider, llmApiKey } = body;

    if (!story) {
      return NextResponse.json({ error: "Story/Requirements data is required" }, { status: 400 });
    }

    if (!testPlan) {
      return NextResponse.json({ error: "Test Plan is required to generate test cases" }, { status: 400 });
    }

    if (!llmApiKey) {
      return NextResponse.json({ error: "LLM API Key is required" }, { status: 401 });
    }

    const isApiTest = story.source === "swagger" || story.source === "openapi";

    let systemPrompt = `You are an expert QA Automation Engineer specializing in BDD (Behavior-Driven Development) test case generation.
Your task is to generate comprehensive, production-ready BDD scenarios in Gherkin format based on the provided requirements and test plan.

Return your output as a RAW JSON object. DO NOT wrap the JSON in markdown blocks. DO NOT add any conversational text before or after the JSON.

The JSON MUST exactly match this schema:
{
  "testCases": [
    {
      "scenarioId": "TC-001",
      "title": "Clear, concise title",
      "priority": "High|Medium|Low",
      "type": "UI|API|Functional|Security|Performance|Edge Case",
      "steps": [
        "Given ...",
        "When ...",
        "Then ...",
        "And ..."
      ],
      "expectedResult": "Brief description of the expected outcome"
    }
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
- If the user provides specific valid or invalid test data in the custom instructions, you MUST prioritize and include it directly in your scenarios.`;

    if (isApiTest) {
      systemPrompt += `\n\nAPI SPECIFIC INSTRUCTIONS:
1. DO NOT write generic steps like "Then the response should be valid".
2. Include explicit, strict assertions for status codes, headers, and specific fields in the response body.
3. Generate Data-Driven tests using "Scenario Outline" and "Examples" tables for multiple inputs.
4. Include Contract/Schema Validation (Asserting that the response structure perfectly matches the expected JSON schema).
5. Include explicit assertions for field types (e.g., 'And "category.id" should be a number').

Example of expected API step formatting:
"Scenario Outline: Retrieve pet successfully with valid petId",
"Given the API base URL is set",
"When I send a GET request to '/pet/<petId>'",
"Then the response status code should be 200",
"And the response content type should be 'application/json'",
"And the response body should contain 'id' equal to <petId>",
"And 'category.id' should be a number",
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
    ${testcasePrompt ? testcasePrompt : "No restrictions. You MUST generate maximum coverage scenarios exhaustively covering ALL categories (Smoke, Functional, Negative, Edge, Security, Non-Functional/Performance) with concrete test data."}

    Remember: Return ONLY valid JSON matching the schema. No markdown wrapping. Include concrete TEST DATA in Examples tables prioritizing any user-provided values. Ensure ALL test categories are covered unless explicitly restricted above.`;

    let generatedText = "";

    // Inline LLM call
    const provider = llmProvider || "groq";
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Groq API error");
      generatedText = data.choices[0].message.content;
    } else if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + llmApiKey },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "OpenAI API error");
      generatedText = data.choices[0].message.content;
    } else if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { 
          "x-api-key": llmApiKey, 
          "anthropic-version": "2023-06-01", 
          "content-type": "application/json" 
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          max_tokens: 4000,
          temperature: 0.1
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Anthropic API error");
      generatedText = data.content[0].text;
    }

    let cleanJsonStr = generatedText.trim();
    if (cleanJsonStr.startsWith("```json")) cleanJsonStr = cleanJsonStr.substring(7);
    else if (cleanJsonStr.startsWith("```")) cleanJsonStr = cleanJsonStr.substring(3);
    if (cleanJsonStr.endsWith("```")) cleanJsonStr = cleanJsonStr.substring(0, cleanJsonStr.length - 3);
    cleanJsonStr = cleanJsonStr.trim();

    const result = JSON.parse(cleanJsonStr);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Generate Test Cases Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate test cases" }, { status: 500 });
  }
}
