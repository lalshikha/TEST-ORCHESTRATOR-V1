# Test Orchestrator v1 (TestOrchv1_final)
**Comprehensive AI-Powered QA Automation & BDD Generation Platform**

Welcome to **TestOrchv1_final**. This application is a state-of-the-art, Next.js-based test orchestration platform designed to streamline the QA process. By bridging your product requirements (Jira, Swagger) directly with advanced Large Language Models (LLMs), TestOrchv1 automatically generates structured test plans and production-ready BDD (Behavior-Driven Development) test cases.

---

## 🌟 Core Features

### 1. Multi-Source Requirement Ingestion
*   **Jira Integration:** Connect directly to your Jira workspace. Load boards, browse stories, and select multiple tickets to form the basis of your test suite.
*   **Swagger API Parsing:** Input a raw Swagger/OpenAPI JSON URL. The app handles multiple authentication types (Bearer, API Key, Basic) and allows you to cherry-pick specific endpoints and methods to test.
*   *(Coming Soon: OpenAPI file upload and Azure DevOps integration).*

### 2. Intelligent Test Plan Generation
*   Synthesizes selected requirements into a structured, human-readable Test Plan.
*   **Template Support:** Upload a `.docx` or `.txt` reference template to enforce your organization's specific test plan structure.
*   **Custom Prompting:** Inject specific focus areas (e.g., "Focus strictly on backend database updates").

### 3. Exhaustive BDD Test Case Generation
*   **Gherkin Syntax:** Generates scenarios in standard `Given / When / Then` format, ready to be integrated into frameworks like Playwright or Cucumber.
*   **Categorization & Tagging:** Automatically categorizes tests into `UI`, `API`, `Functional`, `Security`, `Performance`, and `Edge Case`, assigning Priority tags.
*   **Concrete Test Data:** Eliminates generic placeholders. The engine forces the inclusion of concrete data (e.g., actual SQL injection strings `1 OR 1=1`, explicit boundaries like `0` or `-1`, and malformed payloads) inside Scenario Outline `Examples` tables.
*   **Exhaustive Default Coverage:** Unless restricted, the system automatically generates Happy Path, Negative Validation, Edge Cases, Security tests, and Contract/Schema validations.

### 4. Analytics & Export
*   **Dashboard Insights:** Visualizes your test coverage with donut charts, calculating total steps, edge cases, and estimated manual time saved.
*   **Frictionless Export:** Export your generated test cases directly to **CSV** (perfect for importing into test management tools like Zephyr or Xray) or **Markdown (MD)** for documentation.

---

## 🚀 Step-by-Step Workflow

### Step 1: Configure LLM
Click **Setup Connection** in the sidebar. Select your preferred provider (`Groq`, `OpenAI`, or `Anthropic`) and enter your API key. *Note: For high-speed generation, Groq (llama-3.3-70b-versatile) is recommended.*

### Step 2: Get Requirements
Click **1. GET REQUIREMENTS**. 
*   **For Jira:** Enter URL, Email, and Token. Load your board, check the stories you want to test, and click Confirm.
*   **For Swagger:** Enter the `.json` URL (e.g., `https://api.example.com/v1/swagger.json`). Provide auth headers if the API is secured. Fetch the endpoints, select the ones to test, and click Confirm.

### Step 3: Create Test Plan
Click **2. CREATE TEST PLAN**. 
You can optionally attach a Reference Template file. Click **Generate Plan** to let the AI process the requirements. Review the output in the Test Plan tab.

### Step 4: Create BDD Test Cases
Click **3. CREATE BDD TESTCASES**.
Provide any custom scope limits (e.g., "Smoke tests only"). If left blank, the app runs in **Exhaustive Mode**. Once generated, view them in the Test Cases tab, review the Analytics, and export to CSV/MD.

---

## 💡 Best Practices & Pro Tips

### 1. Steering the Test Case Engine
The LLM is configured to be exhaustive. If you want to limit token usage or scope, use the **Custom Instructions** box during Step 4:
*   *Example:* `"Only generate Happy Path and Smoke tests. Maximum 5 scenarios."`
*   *Example:* `"Focus heavily on XSS and Path Traversal vulnerabilities."`

### 2. Providing Custom Test Data
If you have specific valid accounts or data you want the AI to use, provide it in the Custom Instructions. The engine is programmed to prioritize user-provided data.
*   *Example:* `"Use 'admin_user' and 'Pass@123' for successful login scenarios. Use 'deleted_item_09' for negative lookup."`

### 3. Swagger URL Formatting
Ensure you are pointing the app to the **raw JSON specification**, not the visual Swagger UI page.
*   ✅ `https://petstore.swagger.io/v2/swagger.json`
*   ❌ `https://petstore.swagger.io/`
*(Note: TestOrchv1 has built-in auto-correction for common UI URLs, but raw JSON links are always safer).*

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
