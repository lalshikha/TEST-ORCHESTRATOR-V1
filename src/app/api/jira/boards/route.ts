import { NextResponse } from "next/server";

interface JiraBoardResponse {
  id: number;
  name: string;
  type: string;
  self?: string;
}

export async function POST(req: Request) {
  try {
    const { url, email, token } = await req.json();

    if (!url || !email || !token) {
      return NextResponse.json(
        { success: false, error: "Jira URL, email, and token are required." },
        { status: 400 }
      );
    }

    const baseUrl = String(url).replace(/\/$/, "");
    const auth = Buffer.from(`${email}:${token}`).toString("base64");

    const headers = {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    };

    const boards: JiraBoardResponse[] = [];
    let startAt = 0;
    const maxResults = 50;
    let isLast = false;

    while (!isLast) {
      const response = await fetch(
        `${baseUrl}/rest/agile/1.0/board?startAt=${startAt}&maxResults=${maxResults}`,
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        return NextResponse.json(
          {
            success: false,
            error: `Failed to load boards from Jira. ${errorText || response.statusText}`,
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      const pageBoards = Array.isArray(data.values) ? data.values : [];

      boards.push(
        ...pageBoards.map((board: any) => ({
          id: board.id,
          name: board.name,
          type: board.type,
          self: board.self,
        }))
      );

      isLast = Boolean(data.isLast);
      startAt += Number(data.maxResults || maxResults);

      if (pageBoards.length === 0) {
        isLast = true;
      }
    }

    return NextResponse.json({
      success: true,
      boards,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unexpected error while loading Jira boards.",
      },
      { status: 500 }
    );
  }
}