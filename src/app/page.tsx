"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as mammoth from "mammoth";
import { saveAs } from "file-saver";
import {
  LayoutDashboard, FileText, ListChecks, CheckCircle2, Loader2, ChevronRight,
  Download, UploadCloud, FileCode2, ListOrdered, ShieldAlert, Search, FileDown,
  Settings, Key, Link as LinkIcon, PieChart, Target, Zap, Check, AlertCircle,
  Moon, Sun, MessageSquareText, Sparkles, Layers3, CircleDashed, Braces, Database,
} from "lucide-react";

type StepStatus = "disabled" | "active" | "completed";
type TabView = "dashboard" | "testPlan" | "testcases" | "analytics";
type LLMProvider = "groq" | "openai" | "anthropic";
type RequirementSource = "jira" | "swagger" | "openapi" | "ado";
type AuthType = "none" | "bearer" | "apikey" | "basic" | "custom";

interface JiraBoard { id: number; name: string; type: string; }
interface JiraStory { id: string; key: string; summary: string; description: string; }
interface RequirementContext {
  id: string; key: string; title: string; summary: string;
  description: string; source: RequirementSource; itemsCount: number;
  metadata?: any; raw?: any;
}

const CHART_COLORS = ["#2F81F7", "#3FB950", "#D29922", "#FF6B6B", "#A371F7", "#14b8a6", "#9DA7B3"];

const SOURCE_HELP: Record<RequirementSource, { label: string; hint: string; icon: any; accent: string; bg: string; border: string; }> = {
  jira: { label: "Jira", hint: "Select Jira stories to create UI/API testcases.", icon: Layers3, accent: "text-[#A371F7]", bg: "bg-[#A371F7]/10", border: "border-[#A371F7]/20" },
  swagger: { label: "Swagger", hint: "Select Swagger to create API testcases from endpoint definitions.", icon: LinkIcon, accent: "text-[#2F81F7]", bg: "bg-[#2F81F7]/10", border: "border-[#2F81F7]/20" },
  openapi: { label: "OpenAPI", hint: "Select OpenAPI to create API testcases from specification files or URLs.", icon: Braces, accent: "text-[#3FB950]", bg: "bg-[#3FB950]/10", border: "border-[#3FB950]/20" },
  ado: { label: "ADO", hint: "Select ADO to create testcases from Azure DevOps work items or queries.", icon: Database, accent: "text-[#D29922]", bg: "bg-[#D29922]/10", border: "border-[#D29922]/20" },
};

export default function DashboardPage() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<TabView>("dashboard");
  const [step1Status, setStep1Status] = useState<StepStatus>("active");
  const [step2Status, setStep2Status] = useState<StepStatus>("disabled");
  const [step3Status, setStep3Status] = useState<StepStatus>("disabled");

  const [notification, setNotification] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(true);
  const [isRequirementsModalOpen, setIsRequirementsModalOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isTestcasePromptModalOpen, setIsTestcasePromptModalOpen] = useState(false);

  const [llmProvider, setLlmProvider] = useState<LLMProvider>("groq");
  const [apiKeys, setApiKeys] = useState({ groq: "", openai: "", anthropic: "" });
  const isLlmConfigured = !!apiKeys[llmProvider] && apiKeys[llmProvider].trim().length > 0;

  const [requirementSource, setRequirementSource] = useState<RequirementSource>("jira");
  const [requirementsContext, setRequirementsContext] = useState<RequirementContext | null>(null);

  const [jiraCreds, setJiraCreds] = useState({ url: "", email: "", token: "" });
  const [boards, setBoards] = useState<JiraBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedBoard, setSelectedBoard] = useState<JiraBoard | null>(null);
  const [stories, setStories] = useState<JiraStory[]>([]);
  const [selectedStories, setSelectedStories] = useState<JiraStory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [swaggerConfig, setSwaggerConfig] = useState({ url: "", authType: "none" as AuthType, authKey: "", authValue: "", serviceName: "" });
  const [swaggerData, setSwaggerData] = useState<any>(null);
  const [availableEndpoints, setAvailableEndpoints] = useState<{path: string, method: string, summary: string}[]>([]);
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([]);

  const [openApiConfig, setOpenApiConfig] = useState({ url: "", specText: "", serviceName: "" });
  const [adoConfig, setAdoConfig] = useState({ orgUrl: "", project: "", token: "", query: "" });

  const [customPrompt, setCustomPrompt] = useState("");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [testcasePrompt, setTestcasePrompt] = useState("");
  const [testPlanData, setTestPlanData] = useState<any>(null);
  const [testcasesData, setTestcasesData] = useState<any>(null);

  const testcasesRef = useRef<HTMLDivElement>(null);
  const testPlanRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isLlmConfigured) {
      setIsConfigModalOpen(true);
      setStep1Status("active"); setStep2Status("disabled"); setStep3Status("disabled");
    }
  }, [isLlmConfigured]);

  useEffect(() => {
    mainContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  const theme = isDarkMode
    ? { appBg: "bg-[#0B0F14]", panelBg: "bg-[#161B22]", panelBgSoft: "bg-[#0B0F14]", panelBgMuted: "bg-[#21262D]", border: "border-[#30363D]", text: "text-[#E6EDF3]", textSoft: "text-[#9DA7B3]", textMute: "text-[#6E7681]", primary: "text-[#2F81F7]", primaryBg: "bg-[#2F81F7]", primarySoft: "bg-[#2F81F7]/10", success: "text-[#3FB950]", successBg: "bg-[#3FB950]/10", warning: "text-[#D29922]", warningBg: "bg-[#D29922]/10", danger: "text-[#FF6B6B]", dangerBg: "bg-[#FF6B6B]/10", hover: "hover:bg-[#21262D]", sidebar: "bg-[#161B22]", overlay: "bg-black/70", inputBg: "bg-[#0B0F14]", card: "bg-[#161B22]", tableHead: "bg-[#161B22]" }
    : { appBg: "bg-[#F6F8FA]", panelBg: "bg-white", panelBgSoft: "bg-[#F6F8FA]", panelBgMuted: "bg-[#EEF2F6]", border: "border-[#D0D7DE]", text: "text-[#0F172A]", textSoft: "text-[#475569]", textMute: "text-[#64748B]", primary: "text-[#0969DA]", primaryBg: "bg-[#0969DA]", primarySoft: "bg-[#0969DA]/10", success: "text-[#1A7F37]", successBg: "bg-[#1A7F37]/10", warning: "text-[#9A6700]", warningBg: "bg-[#9A6700]/10", danger: "text-[#CF222E]", dangerBg: "bg-[#CF222E]/10", hover: "hover:bg-[#F3F4F6]", sidebar: "bg-white", overlay: "bg-black/55", inputBg: "bg-white", card: "bg-white", tableHead: "bg-[#F6F8FA]" };

  const filteredStories = useMemo(() => stories.filter(s => s.key.toLowerCase().includes(searchQuery.toLowerCase()) || s.summary.toLowerCase().includes(searchQuery.toLowerCase())), [stories, searchQuery]);

  const stats = useMemo(() => {
    if (!testcasesData?.testCases) return null;
    const cases = testcasesData.testCases;
    let totalSteps = 0, edgeCases = 0;
    cases.forEach((c: any) => {
      if (c.steps && Array.isArray(c.steps)) totalSteps += c.steps.length;
      const joined = `${c.type || ""} ${c.title || ""}`.toLowerCase();
      if (joined.includes("edge") || joined.includes("boundary") || joined.includes("negative") || joined.includes("invalid") || joined.includes("error")) edgeCases++;
    });
    const byType = cases.reduce((acc: any, curr: any) => { acc[curr.type || "Standard"] = (acc[curr.type || "Standard"] || 0) + 1; return acc; }, {});
    return { total: cases.length, totalSteps, timeSaved: cases.length * 15, edgeCases, byType };
  }, [testcasesData]);

  const requirementPayload = useMemo(() => {
    if (!requirementsContext) return null;
    return { ...requirementsContext };
  }, [requirementsContext]);

  const showNotification = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(null), 4000); };
  const handleKeyChange = (provider: LLMProvider, value: string) => setApiKeys(prev => ({ ...prev, [provider]: value }));
  const handleJiraCredsChange = (field: string, value: string) => setJiraCreds(prev => ({ ...prev, [field]: value }));

  const handleSaveLlmConfig = () => {
    if (!apiKeys[llmProvider]?.trim()) return alert(`Enter ${llmProvider} API key.`);
    setIsConfigModalOpen(false);
    if (!requirementsContext) { setStep1Status("active"); setStep2Status("disabled"); setStep3Status("disabled"); }
    showNotification("Configuration saved.");
  };

  const applyLoadedRequirements = (ctx: RequirementContext, msg = "Requirements loaded.") => {
    setRequirementsContext(ctx);
    setTestPlanData(null); setTestcasesData(null); setCustomPrompt(""); setReferenceFile(null); setTestcasePrompt("");
    setStep1Status("completed"); setStep2Status("active"); setStep3Status("disabled");
    setIsRequirementsModalOpen(false);
    showNotification(msg);
  };

  const buildGenericReqContext = (source: RequirementSource, payload: any, config: any): RequirementContext => {
    const count = Array.isArray(payload) ? payload.length : payload?.paths ? Object.keys(payload.paths).length : 1;

    let authNote = "";
    if (config.authType && config.authType !== "none") {
      const authKeyName = config.authType === "bearer" ? "Authorization Bearer" : (config.authKey || "Custom Token");
      authNote = `[SYSTEM REQUIREMENT: The API uses ${config.authType.toUpperCase()} authentication (Header/Key: ${authKeyName}). Ensure that generated test cases explicitly include steps for authenticating with valid and invalid credentials using this method.]\n\n`;
    }

    const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);

    return {
      id: `${source}-${Date.now()}`, key: source.toUpperCase(),
      title: config.serviceName || config.project || `${source.toUpperCase()} Requirements`,
      summary: `Loaded ${count} ${source} requirement(s). ${authNote ? "Auth rules applied." : ""}`,
      description: authNote + payloadString,
      source, itemsCount: count, metadata: config, raw: payload,
    };
  };

  const loadGenericApiReq = async (endpoint: string, config: any, source: RequirementSource, msg: string) => {
    try {
      setIsLoading(true); setLoadingMsg(`Loading ${source}...`);
      const res = await axios.post(endpoint, config);

      const payload = res.data?.data || res.data?.requirements || res.data;
      if (!payload) throw new Error(`No valid data returned from ${source} endpoint.`);

      applyLoadedRequirements(buildGenericReqContext(source, payload, config), msg);
    } catch (e: any) { 
      console.error(e);
      alert(e.response?.data?.error || e.message || `Failed to load ${source}.`); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const fetchSwaggerSpec = async () => {
    if (!swaggerConfig.url.trim()) return alert("Enter Swagger URL.");
    if ((swaggerConfig.authType === "apikey" || swaggerConfig.authType === "custom") && !swaggerConfig.authKey.trim()) {
      return alert("Header name is required for API Key authentication.");
    }
    try {
      setIsLoading(true); setLoadingMsg("Fetching Swagger definitions...");

      const res = await axios.post("/api/requirements/swagger", swaggerConfig);

      let payload = null;
      if (res.data?.data?.paths) {
        payload = res.data.data;
      } else if (res.data?.requirements?.paths) {
        payload = res.data.requirements;
      } else if (res.data?.paths) {
        payload = res.data;
      }

      if (!payload || !payload.paths) {
        throw new Error(res.data?.error || "Invalid Swagger JSON. No paths found. Are you pointing to the Swagger UI page instead of the raw JSON endpoint (e.g., /v1/swagger.json)?");
      }

      setSwaggerData(payload);

      const endpoints: {path: string, method: string, summary: string}[] = [];
      Object.keys(payload.paths).forEach(path => {
        Object.keys(payload.paths[path]).forEach(method => {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            summary: payload.paths[path][method].summary || ""
          });
        });
      });
      setAvailableEndpoints(endpoints);
      setSelectedEndpoints([]);
      showNotification("Swagger definitions loaded.");
    } catch (e: any) { 
      console.error("Swagger Fetch Error:", e);
      alert(e.response?.data?.error || e.message || "Failed to fetch Swagger JSON."); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleConfirmSwagger = () => {
    if (!swaggerData) return alert("Fetch Swagger data first.");
    if (selectedEndpoints.length === 0) return alert("Select at least one endpoint.");

    // Filter paths
    const filteredPaths: any = {};
    selectedEndpoints.forEach(ep => {
      const [method, path] = ep.split(" ");
      if (!filteredPaths[path]) filteredPaths[path] = {};
      filteredPaths[path][method.toLowerCase()] = swaggerData.paths[path][method.toLowerCase()];
    });

    const filteredPayload = {
      ...swaggerData,
      paths: filteredPaths
    };

    const context = buildGenericReqContext("swagger", filteredPayload, swaggerConfig);
    // Explicit instructions about comprehensive coverage & contract testing
    context.description = `[SYSTEM REQUIREMENT: The user has selected specific endpoints to test. You MUST generate comprehensive test coverage for these endpoints, including positive flows, negative flows, boundary conditions, auth scenarios, and CONTRACT VALIDATION based on the schema models provided (e.g., verifying response object shapes), UNLESS explicitly restricted in the custom prompt.]\n\n` + context.description;

    applyLoadedRequirements(context, `${selectedEndpoints.length} endpoints selected.`);
  };

  const toggleEndpointSelection = (endpointId: string) => {
    setSelectedEndpoints(prev => prev.includes(endpointId) ? prev.filter(id => id !== endpointId) : [...prev, endpointId]);
  };

  const handleSelectAllEndpoints = () => {
    if (selectedEndpoints.length === availableEndpoints.length) {
      setSelectedEndpoints([]);
    } else {
      setSelectedEndpoints(availableEndpoints.map(ep => `${ep.method} ${ep.path}`));
    }
  };

  const renderDonutChart = () => {
    if (!stats) return null;
    const entries = Object.entries(stats.byType);
    let cumulativePercent = 0;
    const getCoordinatesForPercent = (percent: number) => { const x = Math.cos(2 * Math.PI * percent); const y = Math.sin(2 * Math.PI * percent); return [x, y]; };
    return (
      <svg viewBox="-1 -1 2 2" className="w-full h-full transform -rotate-90">
        {entries.map(([type, count]: any, i) => {
          const percent = count / stats.total;
          if (percent === 1) return <circle key={type} cx="0" cy="0" r="0.8" fill="transparent" stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth="0.4" />;
          const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
          cumulativePercent += percent;
          const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
          const largeArcFlag = percent > 0.5 ? 1 : 0;
          const pathData = [`M ${startX * 0.8} ${startY * 0.8}`, `A 0.8 0.8 0 ${largeArcFlag} 1 ${endX * 0.8} ${endY * 0.8}`].join(" ");
          return <path key={type} d={pathData} fill="transparent" stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth="0.4" className="transition-all duration-300 hover:stroke-[0.45]" />;
        })}
      </svg>
    );
  };

  const handleLoadBoards = async () => {
    if (!jiraCreds.url || !jiraCreds.email || !jiraCreds.token) return alert("Enter Jira URL, email, and API token.");
    try {
      setIsLoading(true); setLoadingMsg("Loading boards...");
      const res = await axios.post("/api/jira/boards", jiraCreds);
      setBoards(res.data?.boards || []); setStories([]); setSelectedStories([]); setSelectedBoard(null);
      setSelectedBoardId(res.data?.boards?.[0]?.id?.toString() || "");
      showNotification("Boards loaded.");
    } catch (e: any) { alert(e.response?.data?.error || "Failed to load Jira boards."); } finally { setIsLoading(false); }
  };

  const handleLoadJiraStories = async () => {
    if (!selectedBoardId) return alert("Select a board.");
    try {
      setIsLoading(true); setLoadingMsg("Loading stories...");
      const res = await axios.post("/api/jira/stories", { ...jiraCreds, boardId: Number(selectedBoardId) });
      setStories(res.data?.stories || []); setSelectedStories([]);
      setSelectedBoard(boards.find(b => String(b.id) === selectedBoardId) || null);
      showNotification("Stories loaded.");
    } catch (e: any) { alert(e.response?.data?.error || "Failed to load Jira stories."); } finally { setIsLoading(false); }
  };

  const toggleStorySelection = (story: JiraStory) => setSelectedStories(prev => prev.some(s => s.id === story.id) ? prev.filter(s => s.id !== story.id) : [...prev, story]);
  const handleSelectAllStories = () => setSelectedStories(selectedStories.length === filteredStories.length ? [] : [...filteredStories]);

  const handleConfirmJiraRequirements = () => {
    if (!selectedStories.length) return alert("Select at least one story.");
    const ctx: RequirementContext = {
      id: selectedStories.map(s => s.id).join(","), key: selectedStories.map(s => s.key).join(", "),
      title: selectedBoard?.name || "Jira Requirements", summary: selectedStories.map(s => s.summary).join(" | "),
      description: selectedStories.map(s => `[Story ${s.key}]: ${s.summary}\n${s.description || ""}`).join("\n\n---\n\n"),
      source: "jira", itemsCount: selectedStories.length, metadata: { boardId: selectedBoard?.id }, raw: selectedStories,
    };
    applyLoadedRequirements(ctx, `${selectedStories.length} Jira stories loaded.`);
  };

  const handleLoadOpenApiRequirements = () => {
    if (!openApiConfig.url.trim() && !openApiConfig.specText.trim()) return alert("Enter OpenAPI URL or Spec.");
    loadGenericApiReq("/api/requirements/openapi", openApiConfig, "openapi", "OpenAPI requirements loaded.");
  };

  const handleLoadAdoRequirements = () => {
    if (!adoConfig.orgUrl.trim() || !adoConfig.project.trim() || !adoConfig.token.trim()) return alert("Enter ADO details.");
    loadGenericApiReq("/api/requirements/ado", adoConfig, "ado", "ADO requirements loaded.");
  };

  const extractTextFromFile = async (file: File): Promise<string> => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = async (e) => file.name.endsWith(".docx") ? resolve((await mammoth.extractRawText({ arrayBuffer: e.target?.result as ArrayBuffer })).value) : resolve(new TextDecoder().decode(e.target?.result as ArrayBuffer));
    r.onerror = reject; r.readAsArrayBuffer(file);
  });

  const openPlanPromptModal = () => {
    if (!requirementPayload) return alert("Please load requirements first.");
    setIsPromptModalOpen(true);
  };

  const handlePromptModalSubmit = async () => {
    if (!requirementPayload) return alert("No requirements loaded.");
    try {
      setIsPromptModalOpen(false); setIsLoading(true); setLoadingMsg("Generating Test Plan...");
      const templateContext = referenceFile ? await extractTextFromFile(referenceFile) : "";
      const res = await axios.post("/api/generate-plan", { story: requirementPayload, customPrompt, templateContext, llmProvider, llmApiKey: apiKeys[llmProvider] });
      setTestPlanData(res.data.data); setStep2Status("completed"); setStep3Status("active"); setActiveTab("testPlan");
      showNotification("Test plan generated.");
    } catch (e: any) { alert(e.response?.data?.error || "Failed to generate plan."); } finally { setIsLoading(false); }
  };

  const openTestcasePromptModal = () => {
    if (!requirementPayload || !testPlanData) return alert("Please generate the test plan first.");
    setIsTestcasePromptModalOpen(true);
  };

  const handleCreateTestcases = async () => {
    if (!requirementPayload || !testPlanData) return alert("Test plan required.");
    try {
      setIsTestcasePromptModalOpen(false); setIsLoading(true); setLoadingMsg("Generating BDD Test Cases...");
      const res = await axios.post("/api/generate-testcases", { story: requirementPayload, testPlan: testPlanData.testPlan || testPlanData, testcasePrompt, llmProvider, llmApiKey: apiKeys[llmProvider] });
      setTestcasesData(res.data.data); setStep3Status("completed"); setActiveTab("testcases");
      showNotification("BDD test cases generated.");
    } catch (e: any) { alert(e.response?.data?.error || "Failed to generate cases."); } finally { setIsLoading(false); }
  };

  const exportPDF = async (ref: any, prefix: string) => {
    if (!ref.current) return;
    try {
      setIsLoading(true); setLoadingMsg("Exporting PDF...");
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: isDarkMode ? "#0B0F14" : "#FFFFFF" });
      const pdf = new jsPDF("p", "mm", "a4");
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pdf.internal.pageSize.getWidth(), (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width);
      pdf.save(`${prefix}_${(requirementsContext?.key || "export").substring(0, 30)}.pdf`);
      showNotification("PDF exported.");
    } catch { alert("Export failed."); } finally { setIsLoading(false); }
  };

  const exportMarkdown = () => {
    if (!testcasesData?.testCases) return;
    const title = requirementsContext?.key || "Requirements";
    let md = `# Test Cases for ${title}\n\n> ${testcasePrompt ? `Note: ${testcasePrompt}` : "Default coverage"}\n\n`;
    testcasesData.testCases.forEach((tc: any) => { md += `## ${tc.scenarioId}: ${tc.title}\n> Priority: ${tc.priority || "Medium"} | Type: ${tc.type || "General"}\n\n\`\`\`gherkin\n${(tc.steps || []).join("\n")}\n\`\`\`\n**Expected Result:** ${tc.expectedResult || ""}\n\n---\n\n`; });
    saveAs(new Blob([md], { type: "text/markdown;charset=utf-8" }), `Testcases_${title.substring(0, 30)}.md`);
    showNotification("Markdown exported.");
  };

  const exportCSV = () => {
    if (!testcasesData?.testCases) return;
    const title = requirementsContext?.key || "Requirements";
    const headers = ["Scenario ID", "Title", "Priority", "Type", "Steps", "Expected Result"];
    const escapeCsv = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
    const rows = testcasesData.testCases.map((tc: any) => [
      escapeCsv(tc.scenarioId), escapeCsv(tc.title), escapeCsv(tc.priority), escapeCsv(tc.type),
      escapeCsv((tc.steps || []).join('\n')), escapeCsv(tc.expectedResult)
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    saveAs(new Blob([csvContent], { type: "text/csv;charset=utf-8" }), `Testcases_${title.substring(0, 30)}.csv`);
    showNotification("CSV exported.");
  };

  const getPipelineBtnClass = (status: StepStatus) => `group relative w-full rounded-2xl text-left transition-all duration-150 ease-out focus-visible:ring-2 focus-visible:ring-[#2F81F7] outline-none ${(!isLlmConfigured || status === "disabled") ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`;
  const getOuterClass = (status: StepStatus) => (!isLlmConfigured || status === "disabled") ? (isDarkMode ? "rounded-2xl bg-[#11161D] border border-[#2A313C] shadow-lg" : "rounded-2xl bg-[#E9EEF5] border border-[#CBD5E1] shadow-lg") : status === "completed" ? (isDarkMode ? "rounded-2xl bg-gradient-to-b from-[#112417] to-[#0E1812] border border-[#2F6A3F] shadow-lg hover:-translate-y-0.5" : "rounded-2xl bg-gradient-to-b from-[#EAF8EE] to-[#DFF2E5] border border-[#8FD19E] shadow-lg hover:-translate-y-0.5") : (isDarkMode ? "rounded-2xl bg-gradient-to-b from-[#16283E] to-[#101B2A] border border-[#3A6EA5] shadow-lg hover:-translate-y-0.5" : "rounded-2xl bg-gradient-to-b from-[#EAF3FF] to-[#DCEBFF] border border-[#8CB8F5] shadow-lg hover:-translate-y-0.5");
  const getInnerClass = (status: StepStatus) => (!isLlmConfigured || status === "disabled") ? (isDarkMode ? "rounded-[15px] p-4 bg-[#161B22]" : "rounded-[15px] p-4 bg-[#F8FAFC]") : status === "completed" ? (isDarkMode ? "rounded-[15px] p-4 bg-[#13231A]" : "rounded-[15px] p-4 bg-[#E8F8EC]") : (isDarkMode ? "rounded-[15px] p-4 bg-[#13263D]" : "rounded-[15px] p-4 bg-[#EAF3FF]");
  const getAccentClass = (status: StepStatus) => (!isLlmConfigured || status === "disabled") ? (isDarkMode ? "bg-[#6E7681]" : "bg-[#94A3B8]") : status === "completed" ? "bg-[#3FB950]" : "bg-[#2F81F7]";

  const renderDynamicData = (data: any, depth = 1): any => {
    if (!data) return null;
    if (Array.isArray(data)) {
      if (!data.length) return null;
      if (typeof data[0] !== "object") return <ul className={`list-disc pl-5 text-[13px] space-y-1.5 mb-3 ${theme.text}`}>{data.map((item, i) => <li key={i}>{String(item)}</li>)}</ul>;
      const keys = Object.keys(data[0]);
      return (
        <div className={`overflow-x-auto mb-4 rounded-lg border ${theme.border} ${theme.panelBgSoft}`}>
          <table className="w-full text-[13px] text-left">
            <thead className={`${theme.tableHead} ${theme.text} border-b ${theme.border}`}><tr>{keys.map(k => <th key={k} className="py-2 px-3">{k}</th>)}</tr></thead>
            <tbody className={`divide-y ${theme.border}`}>{data.map((item, i) => <tr key={i} className={theme.hover}>{keys.map(k => <td key={k} className={`py-2 px-3 ${theme.textSoft}`}>{typeof item[k] === "object" ? JSON.stringify(item[k]) : String(item[k])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }
    if (typeof data === "object") return <div className="space-y-4 mb-4">{Object.entries(data).map(([k, v]: [string, any], i) => <div key={i} className={depth === 1 ? "mb-6" : `ml-3 border-l pl-3 ${theme.border}`}><h4 className={`font-semibold ${depth === 1 ? "text-[16px] border-b pb-1" : "text-[14px]"} mb-2 ${theme.text}`}>{k}</h4>{typeof v === "object" ? renderDynamicData(v, depth + 1) : <span className={`text-[13px] whitespace-pre-wrap ${theme.textSoft}`}>{String(v)}</span>}</div>)}</div>;
    return <span className={`text-[13px] ${theme.textSoft}`}>{String(data)}</span>;
  };

  const statusItems = [
    { key: "source", title: "Requirement source", description: requirementsContext ? `${SOURCE_HELP[requirementsContext.source].label} selected.` : "Choose Jira, Swagger, OpenAPI, or ADO.", value: requirementsContext ? SOURCE_HELP[requirementsContext.source].label : "Pending", success: !!requirementsContext, icon: requirementsContext ? SOURCE_HELP[requirementsContext.source].icon : CircleDashed, accent: requirementsContext ? SOURCE_HELP[requirementsContext.source].accent : theme.textMute, bg: requirementsContext ? SOURCE_HELP[requirementsContext.source].bg : isDarkMode ? "bg-[#30363D]/30" : "bg-[#EEF2F6]", border: requirementsContext ? SOURCE_HELP[requirementsContext.source].border : theme.border },
    { key: "requirements", title: "Loaded requirements", description: requirementsContext ? requirementsContext.summary : "Requirements not loaded yet.", value: requirementsContext ? requirementsContext.itemsCount : "Pending", success: !!requirementsContext, icon: ListChecks, accent: "text-[#2F81F7]", bg: "bg-[#2F81F7]/10", border: "border-[#2F81F7]/20" },
    { key: "plan", title: "Test plan", description: testPlanData ? "Test plan generated." : "Create test plan is pending.", value: testPlanData ? "Ready" : "Pending", success: !!testPlanData, icon: FileText, accent: "text-[#3FB950]", bg: "bg-[#3FB950]/10", border: "border-[#3FB950]/20" },
    { key: "bdd", title: "BDD testcases", description: testcasesData?.testCases?.length ? "Scenarios generated." : "Create BDD testcases is pending.", value: testcasesData?.testCases?.length || "Pending", success: !!testcasesData?.testCases?.length, icon: Zap, accent: "text-[#D29922]", bg: "bg-[#D29922]/10", border: "border-[#D29922]/20" }
  ];

  return (
    <div className={`flex h-screen overflow-hidden font-sans text-[14px] antialiased ${theme.appBg} ${theme.text}`}>
      {notification && <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-[150] flex items-center gap-2 border ${theme.panelBg} border-[#3FB950]`}><CheckCircle2 className="w-5 h-5 text-[#3FB950]" /><span className="font-medium text-[13px]">{notification}</span></div>}
      {isLoading && <div className={`fixed inset-0 ${theme.overlay} backdrop-blur-sm z-[140] flex items-center justify-center p-4`}><div className={`p-6 rounded-xl shadow-xl flex flex-col items-center gap-3 w-full max-w-[260px] border ${theme.panelBg} ${theme.border}`}><Loader2 className="w-8 h-8 text-[#2F81F7] animate-spin" /><p className="font-medium text-[13px] text-center">{loadingMsg}</p></div></div>}

      <aside className={`w-60 flex flex-col z-20 shrink-0 border-r ${theme.sidebar} ${theme.border}`}>
        <div className={`p-5 flex items-center gap-3 border-b ${theme.border}`}><div className="bg-[#2F81F7] p-1.5 rounded-md"><Target className="w-5 h-5 text-white" /></div><h1 className="text-[16px] font-semibold">Orchestrator</h1></div>
        <nav className={`flex-1 p-3 flex flex-col gap-1 overflow-y-auto ${!isLlmConfigured ? "opacity-50 pointer-events-none" : ""}`}>
          <div className={`text-[11px] font-semibold uppercase tracking-wider mb-2 pl-3 mt-2 ${theme.textSoft}`}>Menu</div>
          <button onClick={() => setActiveTab("dashboard")} className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-[13px] ${activeTab === "dashboard" ? "bg-[#2F81F7] text-white" : `${theme.textSoft} ${theme.hover}`}`}><LayoutDashboard className="w-4 h-4" /> Dashboard</button>
          <button onClick={() => setActiveTab("testPlan")} className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-[13px] ${activeTab === "testPlan" ? "bg-[#2F81F7] text-white" : `${theme.textSoft} ${theme.hover}`}`}><FileText className="w-4 h-4" /> Test Plan</button>
          <button onClick={() => setActiveTab("testcases")} className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-[13px] ${activeTab === "testcases" ? "bg-[#2F81F7] text-white" : `${theme.textSoft} ${theme.hover}`}`}><ListChecks className="w-4 h-4" /> Test Cases</button>
          {testcasesData && <><div className={`text-[11px] font-semibold uppercase tracking-wider mb-2 pl-3 mt-6 ${theme.textSoft}`}>Insights</div><button onClick={() => setActiveTab("analytics")} className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-[13px] border ${activeTab === "analytics" ? "bg-[#2F81F7]/10 text-[#2F81F7] border-[#2F81F7]/30" : `border-transparent ${theme.textSoft} ${theme.hover}`}`}><PieChart className="w-4 h-4" /> Analytics</button></>}
        </nav>
        <div className={`p-4 border-t ${theme.border} space-y-2`}>
          <button onClick={() => setIsConfigModalOpen(true)} className={`flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border text-[13px] font-semibold ${isLlmConfigured ? `${theme.successBg} border-[#3FB950]/50 text-[#3FB950]` : `${theme.dangerBg} border-[#FF6B6B]/50 text-[#FF6B6B]`}`}>{isLlmConfigured ? <Check className="w-4 h-4" /> : <Settings className="w-4 h-4" />} {isLlmConfigured ? "Configured" : "Setup Connection"}</button>
          <button onClick={() => setIsDarkMode(p => !p)} className={`flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border text-[13px] font-medium ${theme.border} ${theme.panelBgMuted} ${theme.text}`}>{isDarkMode ? <><Sun className="w-4 h-4" /> Light</> : <><Moon className="w-4 h-4" /> Dark</>}</button>
        </div>
      </aside>

      <main ref={mainContentRef} className={`flex-1 overflow-y-auto p-6 md:p-8 relative z-10 ${!isLlmConfigured ? "pointer-events-none blur-[1px]" : ""}`}>
        {activeTab === "dashboard" && (
          <div className="max-w-6xl mx-auto">
            <div className="mb-8"><h2 className="text-2xl font-semibold mb-1">Execution Flow</h2><p className={`text-[14px] ${theme.textSoft}`}>Load requirements, create plan, then generate BDD testcases.</p></div>
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full mb-10">
              <button disabled={!isLlmConfigured} className={getPipelineBtnClass(step1Status)} onClick={() => setIsRequirementsModalOpen(true)}>
                <div className={getOuterClass(step1Status)}><div className={getInnerClass(step1Status)}>
                  <div className={`h-1.5 w-16 rounded-full mb-4 ${getAccentClass(step1Status)}`} />
                  <div className="flex items-center justify-between w-full mb-3"><span className="w-8 h-8 rounded-xl text-[12px] font-bold flex items-center justify-center border bg-[#2F81F7]/15 text-[#2F81F7] border-[#2F81F7]/30">1</span>{step1Status === "completed" ? <CheckCircle2 className="w-5 h-5 text-[#3FB950]" /> : <Layers3 className={`w-4 h-4 ${theme.textSoft}`} />}</div>
                  <h4 className="font-semibold text-[15px]">GET REQUIREMENTS</h4><p className={`text-[12px] mt-1.5 ${theme.textSoft}`}>Pick Jira, Swagger, OpenAPI, or ADO.</p>
                </div></div>
              </button>
              <ChevronRight className={`w-5 h-5 hidden md:block flex-none ${theme.textMute}`} />
              <button disabled={!isLlmConfigured || step2Status === "disabled"} className={getPipelineBtnClass(step2Status)} onClick={openPlanPromptModal}>
                <div className={getOuterClass(step2Status)}><div className={getInnerClass(step2Status)}>
                  <div className={`h-1.5 w-16 rounded-full mb-4 ${getAccentClass(step2Status)}`} />
                  <div className="flex items-center justify-between w-full mb-3"><span className="w-8 h-8 rounded-xl text-[12px] font-bold flex items-center justify-center border bg-[#2F81F7]/15 text-[#2F81F7] border-[#2F81F7]/30">2</span>{step2Status === "completed" ? <CheckCircle2 className="w-5 h-5 text-[#3FB950]" /> : <FileText className={`w-4 h-4 ${theme.textSoft}`} />}</div>
                  <h4 className="font-semibold text-[15px]">CREATE TEST PLAN</h4><p className={`text-[12px] mt-1.5 ${theme.textSoft}`}>Generate plan from requirements.</p>
                </div></div>
              </button>
              <ChevronRight className={`w-5 h-5 hidden md:block flex-none ${theme.textMute}`} />
              <button disabled={!isLlmConfigured || step3Status === "disabled"} className={getPipelineBtnClass(step3Status)} onClick={openTestcasePromptModal}>
                <div className={getOuterClass(step3Status)}><div className={getInnerClass(step3Status)}>
                  <div className={`h-1.5 w-16 rounded-full mb-4 ${getAccentClass(step3Status)}`} />
                  <div className="flex items-center justify-between w-full mb-3"><span className="w-8 h-8 rounded-xl text-[12px] font-bold flex items-center justify-center border bg-[#2F81F7]/15 text-[#2F81F7] border-[#2F81F7]/30">3</span>{step3Status === "completed" ? <CheckCircle2 className="w-5 h-5 text-[#3FB950]" /> : <MessageSquareText className={`w-4 h-4 ${theme.textSoft}`} />}</div>
                  <h4 className="font-semibold text-[15px]">CREATE BDD TESTCASES</h4><p className={`text-[12px] mt-1.5 ${theme.textSoft}`}>Generate BDD scenarios.</p>
                </div></div>
              </button>
            </div>

            <div className={`rounded-2xl border overflow-hidden ${theme.card} ${theme.border}`}>
              <div className={`px-5 py-4 border-b flex items-center gap-3 ${theme.border} ${theme.panelBgSoft}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${theme.primarySoft}`}><CircleDashed className="w-4 h-4 text-[#2F81F7]" /></div>
                <div><h3 className={`text-[11px] uppercase tracking-wider font-semibold ${theme.textMute}`}>Current Status</h3><p className={`text-[12px] ${theme.textSoft}`}>System summary for the current flow.</p></div>
              </div>
              <div className={`divide-y ${theme.border}`}>
                {statusItems.map((item) => (
                  <div key={item.key} className={`px-5 py-4 flex items-center gap-4 ${theme.hover}`}>
                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${item.bg} ${item.border}`}><item.icon className={`w-5 h-5 ${item.accent}`} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><p className="text-[14px] font-semibold">{item.title}</p>{item.success && <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${theme.successBg} text-[#3FB950] border-[#3FB950]/30`}><Check className="w-3 h-3 inline" /> Success</span>}</div>
                      <p className={`text-[12px] mt-1 ${theme.textSoft}`}>{item.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right"><p className={`text-[11px] uppercase tracking-wider ${theme.textMute}`}>Value</p><p className="text-[14px] font-semibold max-w-[220px] truncate">{item.value}</p></div>
                      <div className="w-8 flex justify-center">{item.success ? <div className="w-7 h-7 rounded-full bg-[#3FB950]/15 border border-[#3FB950]/30 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-[#3FB950]" /></div> : <div className={`w-7 h-7 rounded-full border flex items-center justify-center ${theme.border} ${theme.inputBg}`}><CircleDashed className={`w-3.5 h-3.5 ${theme.textMute}`} /></div>}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {requirementsContext && (
              <div className={`mt-6 p-4 rounded-xl border ${theme.card} ${theme.border}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className={`text-[11px] uppercase tracking-wider font-semibold ${theme.textSoft}`}>
                      Loaded Context
                    </p>
                    <h3 className="text-[16px] font-semibold mt-1">
                      {requirementsContext.title}
                    </h3>
                    <p className={`text-[12px] mt-2 ${theme.textSoft}`}>
                      {requirementsContext.summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${SOURCE_HELP[requirementsContext.source].bg} ${SOURCE_HELP[requirementsContext.source].border} ${SOURCE_HELP[requirementsContext.source].accent}`}>
                      {SOURCE_HELP[requirementsContext.source].label}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        isDarkMode
                          ? "bg-[#30363D] border-[#484F58] text-[#E6EDF3]"
                          : "bg-[#EEF2F6] border-[#D0D7DE] text-[#0F172A]"
                      }`}
                    >
                      {requirementsContext.itemsCount} item{requirementsContext.itemsCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "analytics" && stats && (
          <div className="max-w-5xl mx-auto">
            <header className="mb-6 flex justify-between items-end">
              <div><h2 className="text-2xl font-semibold">Coverage Analytics</h2><p className={`text-[13px] mt-1 ${theme.textSoft}`}>Metrics derived from generated models.</p></div>
              <button onClick={() => setActiveTab("testcases")} className={`px-4 py-2 border rounded-lg text-[13px] font-medium ${theme.card} ${theme.border}`}>View Output</button>
            </header>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[{l: "Scenarios", v: stats.total, i: ListChecks, c: "text-[#2F81F7]"}, {l: "BDD Steps", v: stats.totalSteps, i: ListOrdered, c: "text-[#A371F7]"}, {l: "Time Saved (m)", v: stats.timeSaved, i: Zap, c: "text-[#3FB950]"}, {l: "Edge Cases", v: stats.edgeCases, i: ShieldAlert, c: "text-[#FF6B6B]"}].map(m => (
                <div key={m.l} className={`p-5 rounded-xl border ${theme.card} ${theme.border}`}><div className="flex items-center gap-2 mb-2"><m.i className={`w-4 h-4 ${m.c}`} /><span className={`text-[11px] font-semibold uppercase ${theme.textSoft}`}>{m.l}</span></div><span className="text-3xl font-bold">{m.v}</span></div>
              ))}
            </div>
            <div className={`rounded-xl border flex flex-col md:flex-row ${theme.card} ${theme.border}`}>
              <div className={`p-6 flex-1 flex justify-center relative border-b md:border-b-0 md:border-r ${theme.border}`}><div className="w-48 h-48 relative">{renderDonutChart()}<div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-[11px] font-semibold uppercase">Total</span><span className="text-4xl font-bold">{stats.total}</span></div></div></div>
              <div className="flex-1 p-6 flex flex-col justify-center"><h3 className={`text-[12px] font-semibold uppercase mb-4 ${theme.textSoft}`}>Distribution</h3><div className="space-y-3">{Object.entries(stats.byType).map(([t, c]: any, i) => (<div key={t} className="flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full" style={{background: CHART_COLORS[i%CHART_COLORS.length]}}/><span className="text-[13px]">{t}</span></div><div className="flex gap-4"><span className="text-[13px] font-bold">{c}</span><span className={`text-[13px] w-8 text-right ${theme.textSoft}`}>{Math.round(c/stats.total*100)}%</span></div></div>))}</div></div>
            </div>
          </div>
        )}

        {activeTab === "testPlan" && (
          <div className="max-w-4xl mx-auto">
            <header className={`mb-6 flex justify-between items-end border-b pb-4 ${theme.border}`}>
              <div><h2 className="text-2xl font-semibold">Test Plan</h2><p className={`text-[13px] mt-1 ${theme.textSoft}`}>Generated from requirements.</p></div>
              {testPlanData && <button onClick={() => exportPDF(testPlanRef, "TestPlan")} className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-[13px] font-medium ${theme.border} ${theme.panelBgMuted}`}><Download className="w-4 h-4"/> PDF</button>}
            </header>
            {testPlanData ? <div ref={testPlanRef} className={`p-6 rounded-xl border ${theme.card} ${theme.border}`}>{renderDynamicData(testPlanData)}</div> : <div className={`text-center p-12 border border-dashed rounded-xl ${theme.panelBgSoft} ${theme.border}`}><FileText className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h3 className="text-[16px] font-semibold">No Test Plan</h3></div>}
          </div>
        )}

        {activeTab === "testcases" && (
          <div className="max-w-4xl mx-auto">
            <header className={`mb-6 flex justify-between items-end border-b pb-4 ${theme.border}`}>
              <div><h2 className="text-2xl font-semibold">BDD Test Cases</h2></div>
              {testcasesData && <div className="flex gap-2"><button onClick={exportMarkdown} className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] bg-[#A371F7]/10 border border-[#A371F7]/30 text-[#A371F7]"><FileDown className="w-4 h-4"/> MD</button><button onClick={exportCSV} className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-[13px] ${theme.border} ${theme.panelBgMuted}`}><FileDown className="w-4 h-4"/> CSV</button></div>}
            </header>
            {testcasesData ? <div ref={testcasesRef} className="flex flex-col gap-4">{testcasesData.testCases?.map((tc: any, i: number) => (<div key={i} className={`p-5 rounded-xl border ${theme.card} ${theme.border}`}><div className="flex gap-2 mb-3"><span className="px-2 py-1 rounded text-[11px] font-semibold border bg-[#2F81F7]/10 text-[#2F81F7] border-[#2F81F7]/20">{tc.scenarioId}</span><span className={`px-2 py-1 rounded text-[11px] font-semibold border ${tc.priority==="High"?"bg-[#FF6B6B]/10 text-[#FF6B6B] border-[#FF6B6B]/20":"bg-[#D29922]/10 text-[#D29922] border-[#D29922]/20"}`}>{tc.priority}</span>{tc.type && <span className="px-2 py-1 rounded text-[11px] font-semibold border bg-[#14b8a6]/10 text-[#14b8a6] border-[#14b8a6]/20">{tc.type}</span>}</div><h3 className="font-semibold mb-3">{tc.title}</h3><div className={`p-4 rounded-lg font-mono text-[13px] border ${isDarkMode?"bg-[#0B0F14] border-[#30363D]":"bg-[#F8FAFC] border-[#D0D7DE]"}`}>{(tc.steps||[]).map((step:string, j:number)=><div key={j} className={step.startsWith("Given")?"text-[#2F81F7]":step.startsWith("When")?"text-[#A371F7]":step.startsWith("Then")?"text-[#3FB950]":""}>{step}</div>)}</div></div>))}</div> : <div className={`text-center p-12 border border-dashed rounded-xl ${theme.panelBgSoft} ${theme.border}`}><ListChecks className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h3 className="text-[16px] font-semibold">No Scenarios</h3></div>}
          </div>
        )}
      </main>

      {/* Config Modal */}
      {isConfigModalOpen && (
        <div className={`fixed inset-0 ${theme.overlay} z-[160] flex items-center justify-center p-4 backdrop-blur-sm`}>
          <div className={`flex flex-col rounded-xl shadow-2xl w-full max-w-md border ${theme.panelBg} ${theme.border}`}>
            <div className={`p-4 border-b ${theme.border}`}><h3 className="text-[18px] font-semibold flex items-center gap-2"><Settings className="w-5 h-5" /> LLM Config</h3></div>
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-[12px] font-medium mb-2">Provider</label>
                <div className="flex gap-2">{(["groq", "openai", "anthropic"] as LLMProvider[]).map(p => <button key={p} onClick={() => setLlmProvider(p)} className={`flex-1 py-2 rounded-lg text-[12px] font-semibold uppercase border ${llmProvider === p ? "border-[#2F81F7] bg-[#2F81F7]/10 text-[#2F81F7]" : theme.border}`}>{p}</button>)}</div>
              </div>
              <div><label className="block text-[12px] font-medium mb-1.5"><Key className="w-3.5 h-3.5 inline" /> API Key</label><input type="password" value={apiKeys[llmProvider]} onChange={e => handleKeyChange(llmProvider, e.target.value)} className={`w-full border p-2.5 rounded-lg text-[13px] outline-none ${theme.inputBg} ${theme.border}`} /></div>
            </div>
            <div className={`p-4 border-t flex justify-end gap-3 ${theme.border} ${theme.panelBgSoft}`}>
              {isLlmConfigured && <button onClick={() => setIsConfigModalOpen(false)} className={`px-4 py-2 font-medium rounded-lg text-[13px] ${theme.textSoft}`}>Close</button>}
              <button onClick={handleSaveLlmConfig} className="px-4 py-2 bg-[#3FB950] text-white font-medium rounded-lg text-[13px]">Save Configuration</button>
            </div>
          </div>
        </div>
      )}

      {/* Get Requirements Modal */}
      {isRequirementsModalOpen && (
        <div className={`fixed inset-0 ${theme.overlay} z-[130] flex items-center justify-center p-4 backdrop-blur-sm`}>
          <div className={`flex flex-col rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] border ${theme.panelBg} ${theme.border}`}>
            <div className={`p-4 border-b flex items-center justify-between ${theme.border}`}>
              <h3 className="text-[18px] font-semibold flex items-center gap-2"><Layers3 className="w-5 h-5 text-[#2F81F7]" /> Get Requirements</h3>
              <select value={requirementSource} onChange={e => setRequirementSource(e.target.value as RequirementSource)} className={`border px-3 py-1.5 rounded-lg text-[13px] outline-none ${theme.inputBg} ${theme.border}`}>
                <option value="jira">Jira</option><option value="swagger">Swagger</option><option value="openapi" disabled>OpenAPI (Coming Soon)</option><option value="ado" disabled>ADO (Coming Soon)</option>
              </select>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              <div className={`p-3 rounded-lg border flex items-start gap-3 ${SOURCE_HELP[requirementSource].bg} ${SOURCE_HELP[requirementSource].border}`}><Sparkles className={`w-4 h-4 mt-0.5 ${SOURCE_HELP[requirementSource].accent}`} /><p className={`text-[13px] ${SOURCE_HELP[requirementSource].accent}`}>{SOURCE_HELP[requirementSource].hint}</p></div>

              {requirementSource === "jira" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-3"><label className="block text-[12px] font-medium mb-1.5">Jira URL</label><input value={jiraCreds.url} onChange={e=>handleJiraCredsChange("url", e.target.value)} className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`} /></div>
                    <div><label className="block text-[12px] font-medium mb-1.5">Email</label><input value={jiraCreds.email} onChange={e=>handleJiraCredsChange("email", e.target.value)} className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`} /></div>
                    <div className="md:col-span-2"><label className="block text-[12px] font-medium mb-1.5">Token</label><input type="password" value={jiraCreds.token} onChange={e=>handleJiraCredsChange("token", e.target.value)} className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`} /></div>
                  </div>
                  <div className={`p-4 border rounded-xl flex justify-between items-center ${theme.panelBgSoft} ${theme.border}`}>
                    <div><h4 className="font-semibold text-[14px]">1. Load Boards</h4></div>
                    <button onClick={handleLoadBoards} className="px-4 py-2 bg-[#2F81F7] text-white rounded-lg text-[13px]">Load</button>
                  </div>
                  {boards.length > 0 && (
                    <div className={`p-4 border rounded-xl space-y-3 ${theme.panelBgSoft} ${theme.border}`}>
                      <h4 className="font-semibold text-[14px]">2. Select Board & Load Stories</h4>
                      <div className="flex gap-2"><select value={selectedBoardId} onChange={e=>setSelectedBoardId(e.target.value)} className={`flex-1 border p-2 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`}>{boards.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><button onClick={handleLoadJiraStories} className="px-4 py-2 bg-[#2F81F7] text-white rounded-lg text-[13px]">Load Stories</button></div>
                    </div>
                  )}
                  {stories.length > 0 && (
                    <div className={`p-4 border rounded-xl flex flex-col ${theme.panelBgSoft} ${theme.border} max-h-64`}>
                      <div className="flex justify-between items-center mb-3"><h4 className="font-semibold text-[14px]">3. Select Stories ({selectedStories.length} picked)</h4><button onClick={handleSelectAllStories} className="text-[#2F81F7] text-[12px]">Toggle All</button></div>
                      <div className="overflow-y-auto space-y-2">{stories.map(s=><div key={s.id} onClick={()=>toggleStorySelection(s)} className={`p-2 border rounded-lg flex items-start gap-2 cursor-pointer ${selectedStories.some(sel=>sel.id===s.id)? "border-[#2F81F7] bg-[#2F81F7]/10" : theme.border}`}><input type="checkbox" checked={selectedStories.some(sel=>sel.id===s.id)} readOnly className="mt-1" /><div className="text-[12px]"><strong className={theme.text}>{s.key}</strong> <span className={theme.textSoft}>{s.summary}</span></div></div>)}</div>
                    </div>
                  )}
                </div>
              )}

              {requirementSource === "swagger" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5">Swagger JSON URL</label>
                    <input value={swaggerConfig.url} onChange={e=>setSwaggerConfig({...swaggerConfig, url: e.target.value})} placeholder="https://api.example.com/swagger/v1/swagger.json" className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`} />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium mb-1.5">Authentication Type</label>
                    <select value={swaggerConfig.authType} onChange={e=>setSwaggerConfig({...swaggerConfig, authType: e.target.value as AuthType})} className={`w-full border p-2.5 rounded-lg text-[13px] outline-none ${theme.inputBg} ${theme.border}`}>
                      <option value="none">None / Public API</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="apikey">API Key (Custom Header)</option>
                      <option value="basic">Basic Auth</option>
                    </select>
                  </div>

                  {swaggerConfig.authType === "bearer" && (
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5">Bearer Token Value</label>
                      <input type="password" value={swaggerConfig.authValue} onChange={e=>setSwaggerConfig({...swaggerConfig, authValue: e.target.value})} placeholder="eyJh..." className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`} />
                    </div>
                  )}

                  {swaggerConfig.authType === "apikey" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[12px] font-medium mb-1.5">Header Name</label>
                        <input value={swaggerConfig.authKey} onChange={e=>setSwaggerConfig({...swaggerConfig, authKey: e.target.value})} placeholder="e.g., x-api-key" className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`} />
                      </div>
                      <div>
                        <label className="block text-[12px] font-medium mb-1.5">Key Value</label>
                        <input type="password" value={swaggerConfig.authValue} onChange={e=>setSwaggerConfig({...swaggerConfig, authValue: e.target.value})} className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`} />
                      </div>
                    </div>
                  )}

                  {swaggerConfig.authType === "basic" && (
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5">Basic Auth (username:password OR base64)</label>
                      <input type="password" value={swaggerConfig.authValue} onChange={e=>setSwaggerConfig({...swaggerConfig, authValue: e.target.value})} placeholder="admin:secret123" className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`} />
                    </div>
                  )}

                  <div>
                    <label className="block text-[12px] font-medium mb-1.5">Service Name (Optional)</label>
                    <input value={swaggerConfig.serviceName} onChange={e=>setSwaggerConfig({...swaggerConfig, serviceName: e.target.value})} className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`} />
                  </div>

                  <div className={`p-4 border rounded-xl flex justify-between items-center ${theme.panelBgSoft} ${theme.border}`}>
                    <div><h4 className="font-semibold text-[14px]">1. Fetch Swagger Definitions</h4></div>
                    <button onClick={fetchSwaggerSpec} className="px-4 py-2 bg-[#2F81F7] text-white rounded-lg text-[13px]">Fetch Endpoints</button>
                  </div>

                  {availableEndpoints.length > 0 && (
                    <div className={`p-4 border rounded-xl flex flex-col ${theme.panelBgSoft} ${theme.border} max-h-64`}>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-semibold text-[14px]">2. Select Endpoints to Test ({selectedEndpoints.length} picked)</h4>
                        <button onClick={handleSelectAllEndpoints} className="text-[#2F81F7] text-[12px]">Toggle All</button>
                      </div>
                      <div className="overflow-y-auto space-y-2">
                        {availableEndpoints.map(ep => {
                          const id = `${ep.method} ${ep.path}`;
                          const isSelected = selectedEndpoints.includes(id);
                          return (
                            <div key={id} onClick={() => toggleEndpointSelection(id)} className={`p-2 border rounded-lg flex items-start gap-2 cursor-pointer ${isSelected ? "border-[#2F81F7] bg-[#2F81F7]/10" : theme.border}`}>
                              <input type="checkbox" checked={isSelected} readOnly className="mt-1" />
                              <div className="text-[12px]">
                                <strong className={`${ep.method === "GET" ? "text-blue-500" : ep.method === "POST" ? "text-green-500" : ep.method === "PUT" ? "text-orange-500" : ep.method === "DELETE" ? "text-red-500" : theme.text}`}>{ep.method}</strong> 
                                <span className={`ml-2 ${theme.text}`}>{ep.path}</span>
                                {ep.summary && <div className={`mt-0.5 ${theme.textSoft}`}>{ep.summary}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {requirementSource === "openapi" && (
                <div className="space-y-4">
                  <div><label className="block text-[12px] font-medium mb-1.5">OpenAPI URL</label><input value={openApiConfig.url} onChange={e=>setOpenApiConfig({...openApiConfig, url: e.target.value})} placeholder="https://..." className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`} /></div>
                  <div className="flex items-center gap-2"><div className={`flex-1 h-px ${theme.border}`}></div><span className="text-[11px] text-gray-500">OR PASTE YAML/JSON</span><div className={`flex-1 h-px ${theme.border}`}></div></div>
                  <div><textarea value={openApiConfig.specText} onChange={e=>setOpenApiConfig({...openApiConfig, specText: e.target.value})} rows={5} className={`w-full border p-2.5 rounded-lg text-[13px] font-mono ${theme.inputBg} ${theme.border}`} /></div>
                </div>
              )}

              {requirementSource === "ado" && (
                <div className="space-y-4">
                  <div><label className="block text-[12px] font-medium mb-1.5">ADO Org URL</label><input value={adoConfig.orgUrl} onChange={e=>setAdoConfig({...adoConfig, orgUrl: e.target.value})} placeholder="https://dev.azure.com/org" className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-[12px] font-medium mb-1.5">Project</label><input value={adoConfig.project} onChange={e=>setAdoConfig({...adoConfig, project: e.target.value})} className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`} /></div>
                    <div><label className="block text-[12px] font-medium mb-1.5">PAT Token</label><input type="password" value={adoConfig.token} onChange={e=>setAdoConfig({...adoConfig, token: e.target.value})} className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.inputBg} ${theme.border}`} /></div>
                  </div>
                  <div><label className="block text-[12px] font-medium mb-1.5">WIQL Query (Optional)</label><textarea value={adoConfig.query} onChange={e=>setAdoConfig({...adoConfig, query: e.target.value})} rows={3} className={`w-full border p-2.5 rounded-lg text-[13px] font-mono ${theme.inputBg} ${theme.border}`} /></div>
                </div>
              )}

            </div>
            <div className={`p-4 border-t flex justify-end gap-3 ${theme.border} ${theme.panelBgSoft}`}>
              <button onClick={() => setIsRequirementsModalOpen(false)} className={`px-4 py-2 rounded-lg text-[13px] font-medium ${theme.textSoft}`}>Cancel</button>
              {requirementSource === "jira" && <button onClick={handleConfirmJiraRequirements} className="px-4 py-2 bg-[#2F81F7] text-white rounded-lg text-[13px]">Confirm Jira Selection</button>}
              {requirementSource === "swagger" && <button onClick={handleConfirmSwagger} className="px-4 py-2 bg-[#2F81F7] text-white rounded-lg text-[13px]">Confirm Swagger Selection</button>}
              {requirementSource === "openapi" && <button onClick={handleLoadOpenApiRequirements} className="px-4 py-2 bg-[#2F81F7] text-white rounded-lg text-[13px]">Load OpenAPI</button>}
              {requirementSource === "ado" && <button onClick={handleLoadAdoRequirements} className="px-4 py-2 bg-[#2F81F7] text-white rounded-lg text-[13px]">Load ADO</button>}
            </div>
          </div>
        </div>
      )}

      {/* Create Plan Prompt Modal */}
      {isPromptModalOpen && (
        <div className={`fixed inset-0 ${theme.overlay} z-[130] flex items-center justify-center p-4 backdrop-blur-sm`}>
          <div className={`flex flex-col rounded-xl shadow-2xl w-full max-w-xl border ${theme.panelBg} ${theme.border}`}>
            <div className={`p-4 border-b ${theme.border}`}><h3 className="text-[18px] font-semibold">Test Plan Settings</h3></div>
            <div className={`p-5 space-y-5 ${theme.panelBgSoft}`}>
              <div><label className="block text-[12px] font-medium mb-1.5">Reference Template (.docx, optional)</label><input type="file" accept=".docx,.txt" onChange={e => setReferenceFile(e.target.files?.[0] || null)} className={`block w-full text-[13px] ${theme.textSoft} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[12px] file:font-semibold file:bg-[#2F81F7]/10 file:text-[#2F81F7] hover:file:bg-[#2F81F7]/20`} /></div>
              <div><label className="block text-[12px] font-medium mb-1.5">Custom Instructions</label><textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} rows={3} placeholder="e.g. Focus purely on backend logic." className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.card} ${theme.border} ${theme.text}`} /></div>
            </div>
            <div className={`p-4 border-t flex justify-end gap-3 ${theme.border} ${theme.panelBgSoft}`}><button onClick={() => setIsPromptModalOpen(false)} className={`px-4 py-2 rounded-lg text-[13px] ${theme.textSoft}`}>Cancel</button><button onClick={handlePromptModalSubmit} className="px-4 py-2 bg-[#2F81F7] text-white rounded-lg text-[13px]">Generate Plan</button></div>
          </div>
        </div>
      )}

      {/* Create BDD Modal */}
      {isTestcasePromptModalOpen && (
        <div className={`fixed inset-0 ${theme.overlay} z-[130] flex items-center justify-center p-4 backdrop-blur-sm`}>
          <div className={`flex flex-col rounded-xl shadow-2xl w-full max-w-xl border ${theme.panelBg} ${theme.border}`}>
            <div className={`p-4 border-b ${theme.border}`}><h3 className="text-[18px] font-semibold">Customize Scenarios</h3></div>
            <div className={`p-5 space-y-5 ${theme.panelBgSoft}`}>
              <div><label className="block text-[12px] font-medium mb-1.5">Scope / Requirements</label><textarea value={testcasePrompt} onChange={e => setTestcasePrompt(e.target.value)} rows={4} placeholder="e.g. Smoke tests only. Max 5 cases." className={`w-full border p-2.5 rounded-lg text-[13px] ${theme.card} ${theme.border} ${theme.text}`} /></div>
            </div>
            <div className={`p-4 border-t flex justify-end gap-3 ${theme.border} ${theme.panelBgSoft}`}><button onClick={() => setIsTestcasePromptModalOpen(false)} className={`px-4 py-2 rounded-lg text-[13px] ${theme.textSoft}`}>Cancel</button><button onClick={handleCreateTestcases} className="px-4 py-2 bg-[#2F81F7] text-white rounded-lg text-[13px]">Generate Scenarios</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
