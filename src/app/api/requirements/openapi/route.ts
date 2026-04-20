import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url, specText, serviceName } = body;

    let data = specText;

    if (url) {
      const response = await axios.get(url);
      data = response.data;
    }

    if (!data) {
      return NextResponse.json({ error: "OpenAPI URL or spec text is required" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data,
      serviceName
    });
  } catch (error: any) {
    console.error("OpenAPI Fetch Error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch OpenAPI spec. Check URL." },
      { status: 500 }
    );
  }
}
