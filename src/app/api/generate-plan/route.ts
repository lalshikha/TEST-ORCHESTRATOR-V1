import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { story, customPrompt, templateContext, llmProvider, llmApiKey } = body;

    if (!story || !story.description) {
      return NextResponse.json({ 
        success: false, 
        error: 'Story data is required to generate a test plan.' 
      }, { status: 400 });
    }

    if (!llmApiKey) {
      return NextResponse.json({ 
        success: false, 
        error: `API Key for ${llmProvider} is missing. Please configure it in settings.` 
      }, { status: 401 });
    }

    // 1. FIX: Extremely strict system prompt for JSON mode
    let systemInstruction = `You are an expert QA Architect. Your task is to generate a comprehensive Enterprise Test Plan based on the provided Jira User Story.
CRITICAL INSTRUCTION: You MUST return ONLY a valid, parseable JSON object. 
DO NOT include any greetings, explanations, or trailing text. 
DO NOT wrap the output in markdown code blocks (e.g., no \`\`\`json). 
Output raw JSON starting with { and ending with }.`;

    if (templateContext && templateContext.trim() !== "") {
      systemInstruction += `\n\nIMPORTANT FORMATTING RULE:\nYou MUST structure your JSON output to perfectly match the sections and headers found in this reference template:\n"""\n${templateContext}\n"""`;
    } else {
      systemInstruction += `\n\nSince no template was provided, structure your JSON output exactly with these keys: "testPlanId", "title", "objectives", "scope", "testStrategy", "environmentRequirements", and "risks".`;
    }

    if (customPrompt && customPrompt.trim() !== "") {
      systemInstruction += `\n\nADDITIONAL USER CONSTRAINTS:\n${customPrompt}`;
    }

    const userMessage = `Generate a JSON Test Plan for the following Jira Story:\n\nKey: ${story.key}\nSummary: ${story.summary}\nDescription: ${story.description}`;

    let generatedContent = "";

    // 2. Call Groq
    if (llmProvider === 'groq') {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${llmApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userMessage }
          ],
          // Explicitly forcing JSON object format
          response_format: { type: "json_object" },
          temperature: 0.1 // Lower temperature reduces hallucinated conversational text
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Groq Error Data:", data);
        // FIX: Extract Groq's specific 'failed_generation' data if available
        if (data.error?.code === 'json_validate_failed') {
             throw new Error(`The AI failed to generate pure JSON. Groq prevented the response.`);
        }
        throw new Error(data.error?.message || 'Failed to connect to Groq API');
      }

      generatedContent = data.choices[0].message.content;
    }

    // 3. Fallback cleanup just in case the model ignored constraints before parsing
    const cleanContent = generatedContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedPlan = JSON.parse(cleanContent);

    return NextResponse.json({ 
      success: true, 
      data: { testPlan: parsedPlan } 
    });

  } catch (error: any) {
    console.error('Error generating test plan:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An unexpected error occurred during test plan generation.' 
    }, { status: 500 });
  }
}