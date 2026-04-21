import OpenAI from 'openai';
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { story, testPlan, testcasePrompt, llmProvider, llmApiKey } = body;

    if (!story) return NextResponse.json({ error: "Story/Requirements data is required" }, { status: 400 });
    if (!testPlan) return NextResponse.json({ error: "Test Plan is required" }, { status: 400 });
    if (!llmApiKey) return NextResponse.json({ error: "LLM API Key is required" }, { status: 401 });

    const systemPrompt = [
      'You are a QA Automation Architect expert in BDD and Gherkin.',
      'CRITICAL: Return ONLY a raw JSON object. Do NOT wrap in markdown.',
      'The JSON must have exactly ONE key named "testCases" containing an array of objects.',
      'Each object MUST have: "id", "title", "priority" (High/Medium/Low), "type" (BDD),',
      '"category" (Smoke/Functional/Negative/Edge/Security/Performance/UI),',
      'and "steps" (array of strings starting with Given/When/Then).',
      '',
      'Cover ALL categories unless restricted: Smoke, Functional, Negative, Edge, Security, Performance.',
      'Use CONCRETE test data - actual SQL injections, XSS strings, boundary values.',
    ].join('\n');

    const customScope = testcasePrompt ? testcasePrompt : 'No restrictions. Cover all categories exhaustively.';
    const userPrompt = [
      'Generate exhaustive BDD test cases for the following:',
      '',
      '=== REQUIREMENTS ===',
      typeof story.description === 'string' ? story.description : JSON.stringify(story.description, null, 2),
      '',
      '=== TEST PLAN ===',
      typeof testPlan === 'string' ? testPlan : JSON.stringify(testPlan, null, 2),
      '',
      '=== CUSTOM SCOPE ===',
      customScope,
      '',
      'Return ONLY valid JSON with the testCases array. No markdown.',
    ].join('\n');

    let generatedText = '';
    const provider = (llmProvider || 'groq').toLowerCase();

    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey: llmApiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      generatedText = completion.choices[0]?.message?.content || '';
    } else {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + llmApiKey },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Failed to generate test cases from Groq');
      }

      const data = await res.json();
      generatedText = data.choices[0]?.message?.content || '';
    }

    if (!generatedText) throw new Error('AI returned empty response. Check your API key and quota.');

    const cleanContent = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(cleanContent);
    } catch (e) {
      console.error('JSON Parse Error. Raw:', cleanContent?.substring(0, 500));
      return NextResponse.json({ error: 'The AI generated invalid JSON. Please try again.' }, { status: 500 });
    }

    // Defensive: AI sometimes wraps the array directly without the testCases key
    if (Array.isArray(parsedJson)) {
      return NextResponse.json({ testCases: parsedJson });
    }

    if (!parsedJson.testCases || !Array.isArray(parsedJson.testCases)) {
      console.error('Missing testCases key. Got:', JSON.stringify(parsedJson).substring(0, 200));
      return NextResponse.json({ error: "AI response missing 'testCases' array." }, { status: 500 });
    }

    return NextResponse.json({ testCases: parsedJson.testCases });

  } catch (error: any) {
    console.error('Generate Test Cases Error:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
}
