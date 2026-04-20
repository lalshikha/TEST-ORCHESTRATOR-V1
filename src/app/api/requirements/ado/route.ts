import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orgUrl, project, token, query } = body;

    if (!orgUrl || !project || !token) {
      return NextResponse.json({ error: "ADO org URL, project, and token are required" }, { status: 400 });
    }

    const auth = Buffer.from(`:${token}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    };

    const baseUrl = `${orgUrl.replace(/\/$/, '')}/${project}/_apis`;
    let workItemsData = [];

    if (query) {
      const wiqlRes = await axios.post(`${baseUrl}/wit/wiql?api-version=7.0`, { query }, { headers });
      const workItemIds = wiqlRes.data.workItems?.map((wi: any) => wi.id).slice(0, 50);

      if (workItemIds && workItemIds.length > 0) {
         const wiRes = await axios.get(`${baseUrl}/wit/workitems?ids=${workItemIds.join(',')}&api-version=7.0`, { headers });
         workItemsData = wiRes.data.value;
      }
    } else {
      const defaultQuery = "Select [System.Id], [System.Title], [System.State] From WorkItems Where [System.TeamProject] = @project Order By [System.ChangedDate] Desc";
      const wiqlRes = await axios.post(`${baseUrl}/wit/wiql?api-version=7.0`, { query: defaultQuery }, { headers });
      const workItemIds = wiqlRes.data.workItems?.map((wi: any) => wi.id).slice(0, 20);

      if (workItemIds && workItemIds.length > 0) {
         const wiRes = await axios.get(`${baseUrl}/wit/workitems?ids=${workItemIds.join(',')}&api-version=7.0`, { headers });
         workItemsData = wiRes.data.value;
      }
    }

    return NextResponse.json({
      success: true,
      data: workItemsData
    });
  } catch (error: any) {
    console.error("ADO Fetch Error:", error.response?.data || error.message);
    return NextResponse.json(
      { error: "Failed to fetch ADO requirements. Check credentials and URL." },
      { status: 500 }
    );
  }
}
