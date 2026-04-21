# Test Orchestrator v1 (TestOrchv1_final)
**Comprehensive AI-Powered QA Automation & BDD Generation Platform**

Welcome to **TestOrchv1_final**. This application is a state-of-the-art, Next.js-based test orchestration platform designed to streamline the QA process. By bridging product requirements (Jira, Swagger) directly with advanced Large Language Models (LLMs), TestOrchv1 automatically generates structured test plans and production-ready BDD (Behavior-Driven Development) test cases.

---

## 🌟 Core Features

### 1. Multi-Source Requirement Ingestion
*   **Jira Integration:** Connect directly to a Jira workspace. Load boards, browse stories, and select multiple tickets to form the basis of the test suite.
*   **Swagger API Parsing:** Input a raw Swagger/OpenAPI JSON URL or paste JSON/YAML directly. The app handles multiple authentication types (Bearer, API Key, Basic) and allows cherry-picking specific endpoints and methods to test.
*   *(Coming Soon: OpenAPI file upload and Azure DevOps integration).*

### 2. Intelligent Test Plan Generation
*   Synthesizes selected requirements into a structured, human-readable Test Plan.
*   **Template Support:** Upload a `.docx` or `.txt` reference template to enforce specific organizational test plan structures.
*   **Custom Prompting:** Inject specific focus areas (e.g., "Focus strictly on backend database updates").

### 3. Exhaustive BDD Test Case Generation
*   **Gherkin Syntax:** Generates scenarios in standard `Given / When / Then` format, ready to be integrated into frameworks like Playwright or Cucumber.
*   **Categorization & Tagging:** Automatically categorizes tests into `UI`, `API`, `Functional`, `Security`, `Performance`, and `Edge Case`, assigning Priority tags.
*   **Concrete Test Data:** Eliminates generic placeholders. The engine forces the inclusion of concrete data (e.g., actual SQL injection strings `1 OR 1=1`, explicit boundaries like `0` or `-1`, and malformed payloads) inside Scenario Outline `Examples` tables.
*   **Exhaustive Default Coverage:** Unless restricted, the system automatically generates Happy Path, Negative Validation, Edge Cases, Security tests, and Contract/Schema validations.

### 4. Architecture & Security (BYOK)
*   **Bring Your Own Key (BYOK):** The application operates on a stateless architecture. API keys (OpenAI, Groq) and Jira tokens are held securely in the browser session. No credentials are stored on a backend database.
*   **Live Validation:** API keys are actively verified via backend routes before configuration is accepted, preventing silent generation failures.

### 5. Analytics & Export
*   **Dashboard Insights:** Visualizes test coverage with donut charts, calculating total steps, edge cases, and estimated manual time saved.
*   **Frictionless Export:** Export generated test cases directly to **CSV** (for test management tools like Zephyr or Xray), **Markdown (MD)**, or **PDF** for documentation.

---

## 🚀 Step-by-Step Workflow

### Step 1: Configure LLM
Click **Setup Connection** (or the gear icon) in the sidebar. Select a preferred provider (`OpenAI` or `Groq`) and enter the corresponding API key. Click "Verify Connection" to validate the key. 
*Note: Anthropic has been temporarily disabled in this version.*

### Step 2: Get Requirements
Click **1. GET REQUIREMENTS**. 
*   **For Jira:** Enter URL, Email, and Token. Load the board, check the desired stories, and click Confirm.
*   **For Swagger/OpenAPI:** Enter the raw `.json` URL or use the **Paste YAML/JSON** tab for internal APIs. Provide auth headers if the API is secured. Fetch the endpoints, select the ones to test, and click Confirm.

### Step 3: Create Test Plan
Click **2. CREATE TEST PLAN**. 
Optionally attach a Reference Template file. Click **Generate Plan** to process the requirements. Review the output in the Test Plan tab.

### Step 4: Create BDD Test Cases
Click **3. CREATE BDD TESTCASES**.
Provide any custom scope limits (e.g., "Smoke tests only"). If left blank, the app runs in **Exhaustive Mode**, testing security, boundaries, and negative paths. Once generated, view them in the Test Cases tab, review the Analytics, and export the results.

---

## 💡 Best Practices & Pro Tips

### 1. Steering the Test Case Engine
The LLM is configured to be exhaustive by default. To limit token usage or scope, use the **Custom Instructions** box during Step 4:
*   *Example:* `"Only generate Happy Path and Smoke tests. Maximum 5 scenarios."`
*   *Example:* `"Focus heavily on XSS and Path Traversal vulnerabilities."`

### 2. Providing Custom Test Data
If specific valid accounts or data are required, provide them in the Custom Instructions. The engine is programmed to prioritize user-provided data.
*   *Example:* `"Use 'admin_user' and 'Pass@123' for successful login scenarios. Use 'deleted_item_09' for negative lookup."`

### 3. Swagger URL Formatting
Ensure the URL points to the **raw JSON specification**, not the visual Swagger UI HTML page.
*   ✅ `https://petstore.swagger.io/v2/swagger.json`
*   ❌ `https://petstore.swagger.io/`

### 4. Handling 429 Quota Errors (OpenAI)
If a `429 Quota Exceeded` error occurs with an OpenAI key, it typically means the OpenAI Developer account has a $0.00 prepaid credit balance, even if a ChatGPT Plus subscription is active. Ensure the developer API account is funded at `platform.openai.com/account/billing`.

---

## 📝 Example Output (API Context)

When fetching from Swagger, expect highly rigorous, data-driven outputs like this:

```gherkin
Scenario Outline: Validate Pet retrieval boundary cases and invalid formats
Given the API base URL is set
When I send a GET request to "/pet/<petId>"
Then the response status code should be <statusCode>
And the response body should contain "message"
Examples:
| petId               | statusCode |
| -1                  | 400        |
| 0                   | 400        |
| 999999999999999999  | 404        |
| abc_invalid         | 400        |
| ' OR 1=1; --        | 400        |
```

---
*Built for modern QA. Designed for TestOrchv1_final.*
