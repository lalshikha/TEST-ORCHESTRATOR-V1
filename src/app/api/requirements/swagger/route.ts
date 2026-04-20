import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { url, authType, authKey, authValue, serviceName } = body;

    if (!url) {
      return NextResponse.json({ error: "Swagger URL is required" }, { status: 400 });
    }

    // Auto-correct common Swagger UI URLs to their raw JSON equivalents
    if (url.includes("petstore.swagger.io") && !url.endsWith(".json")) {
        url = "https://petstore.swagger.io/v2/swagger.json";
    } else if (url.includes("/swagger/index.html")) {
        url = url.replace("/swagger/index.html", "/swagger/v1/swagger.json");
    } else if (url.includes("/swagger/ui")) {
        url = url.replace("/swagger/ui", "/swagger/v1/swagger.json");
    }

    const headers: Record<string, string> = {
      "Accept": "application/json, text/plain, */*"
    };

    if (authType === "bearer" && authValue) {
      headers["Authorization"] = `Bearer ${authValue}`;
    } else if (authType === "basic" && authValue) {
      const encoded = authValue.includes(':') ? Buffer.from(authValue).toString('base64') : authValue;
      headers["Authorization"] = `Basic ${encoded}`;
    } else if ((authType === "apikey" || authType === "custom") && authKey && authValue) {
      headers[authKey] = authValue;
    }

    // Bypass SSL validation for local endpoints in Node fetch
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    const textData = await response.text();

    if (!response.ok) {
       return NextResponse.json({ 
           success: false,
           error: `Failed to fetch from ${url}. Server responded with ${response.status} ${response.statusText}. Please verify the URL and your access credentials.` 
       }, { status: 200 }); // Returning 200 so Axios doesn't throw a console error, but passing the error gracefully
    }

    let parsedData;
    try {
        parsedData = JSON.parse(textData);
    } catch(e) {
        return NextResponse.json({ 
            success: false,
            error: "The endpoint returned an HTML webpage instead of JSON. Ensure your URL points directly to the raw Swagger JSON file (e.g., /v1/swagger.json or /api-docs) and NOT the visual UI page." 
        }, { status: 200 });
    }

    if (!parsedData || (!parsedData.paths && !parsedData.openapi && !parsedData.swagger)) {
        return NextResponse.json({ 
            success: false,
            error: "The JSON returned is valid, but it does not contain OpenAPI/Swagger API definitions. Ensure this is a valid API spec file." 
        }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
      serviceName
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch Swagger JSON. Check your network connection and URL." },
      { status: 200 }
    );
  }
}
