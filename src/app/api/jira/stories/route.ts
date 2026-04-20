import { NextResponse } from "next/server";

function extractAtlassianText(node: any): string {
  if (!node) return "";

  if (typeof node === "string") return node;

  if (Array.isArray(node)) {
    return node.map(extractAtlassianText).join("");
  }

  if (node.type === "text" && node.text) {
    return node.text;
  }

  if (node.content && Array.isArray(node.content)) {
    const parts = node.content.map(extractAtlassianText).filter(Boolean);

    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "bulletList" ||
      node.type === "orderedList" ||
      node.type === "listItem"
    ) {
      return `${parts.join("")}\n`;
    }

    return parts.join("");
  }

  return "";
}

function normalizeDescription(description: any): string {
  if (!description) return "";
  if (typeof description === "string") return description;

  return extractAtlassianText(description)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: Request) {
  try {
    const { url, email, token, boardId } = await req.json();

    if (!url || !email || !token || !boardId) {
      return NextResponse.json(
        {
          success: false,
          error: "Jira URL, email, token, and boardId are required.",
        },
        { status: 400 }
      );
    }

    const baseUrl = String(url).replace(/\/$/, "");
    const auth = Buffer.from(`${email}:${token}`).toString("base64");

    const headers = {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    };

    const collectedIssues: any[] = [];
    let startAt = 0;
    const maxResults = 50;
    let total = 0;

    do {
      const issuesUrl =
        `${baseUrl}/rest/agile/1.0/board/${boardId}/issue` +
        `?startAt=${startAt}` +
        `&maxResults=${maxResults}` +
        `&fields=summary,description,issuetype`;

      const response = await fetch(issuesUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();

        return NextResponse.json(
          {
            success: false,
            error: `Failed to load board issues from Jira. ${errorText || response.statusText}`,
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      const issues = Array.isArray(data.issues) ? data.issues : [];

      collectedIssues.push(...issues);
      total = Number(data.total || issues.length);
      startAt += Number(data.maxResults || maxResults);

      if (issues.length === 0) break;
    } while (startAt < total);

    const stories = collectedIssues
      .filter((issue) => {
        const typeName = issue?.fields?.issuetype?.name?.toLowerCase?.() || "";
        return typeName !== "epic" && typeName !== "sub-task";
      })
      .map((issue) => ({
        id: String(issue.id),
        key: issue.key,
        summary: issue?.fields?.summary || "Untitled",
        description: normalizeDescription(issue?.fields?.description),
        issueType: issue?.fields?.issuetype?.name || "Issue",
      }));

    return NextResponse.json({
      success: true,
      stories,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message || "Unexpected error while loading Jira board issues.",
      },
      { status: 500 }
    );
  }
}