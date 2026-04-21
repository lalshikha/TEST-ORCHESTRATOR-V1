import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const { provider, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API Key is required.' }, { status: 400 });
    }

    if (provider === 'openai') {
      // Test OpenAI Connection
      const openai = new OpenAI({ apiKey });
      await openai.models.list(); // Throws an error if the key is invalid
      
      return NextResponse.json({ success: true, message: 'OpenAI connection successful.' });
    } 
    else if (provider === 'groq') {
      // Test Groq Connection
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Invalid Groq API Key or connection failed.');
      }

      return NextResponse.json({ success: true, message: 'Groq connection successful.' });
    } 
    else {
      return NextResponse.json({ success: false, error: 'Invalid provider selected.' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Connection Validation Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to validate API key.' 
    }, { status: 401 });
  }
}