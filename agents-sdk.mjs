import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync } from "fs";

const sourceCode = readFileSync("./src/app.js", "utf-8");

const agents = {
    "security-reviewer": {
        description:
            "Security-focused code reviewer. Finds hardcoded secrets, injection risks, missing validation, and insecure patterns.",
        tools: ["Read", "Grep", "Glob"],
        systemPrompt:
            "You are a security engineer. Review code for vulnerabilities. Return findings as CRITICAL / HIGH / MEDIUM / LOW.",
    },
    "code-quality": {
        description:
            "Code quality reviewer. Finds dead code, poor naming, missing error handling, and structural issues.",
        tools: ["Read", "Grep", "Glob"],
        systemPrompt:
            "You are a senior engineer focused on code quality. Return findings grouped by severity.",
    },
    "fix-writer": {
        description:
            "Code fix specialist. Given security and code quality reports, rewrites source files with all issues resolved.",
        tools: ["Read", "Write", "Edit"],
        systemPrompt:
            "You are a senior engineer who fixes code based on audit reports. Fix every reported issue. Output a changelog of every change made.",
    },
};

async function runAgent(agentName, prompt) {
    console.log(`\n⏳ Running ${agentName}...`);
    const start = Date.now();
    let result = "";

    for await (const message of query({
        prompt,
        options: {
            agents,
            allowedTools: ["Read", "Write", "Edit", "Grep", "Glob", "Agent"],
            model: "claude-haiku-4-5-20251001",
        },
    })) {
        if (message.type === "assistant" && message.message?.content) {
            for (const block of message.message.content) {
                if (block.type === "text") {
                    result += block.text;
                }
            }
        }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ ${agentName} done in ${elapsed}s`);
    return result;
}

async function main() {
    const prompt = `Here is the source code to review:\n\n${sourceCode}`;

    // Step 1 — run reviewers in parallel
    console.log("🚀 Step 1: Running review agents in parallel...");
    const [securityReport, qualityReport] = await Promise.all([
        runAgent(
            "security-reviewer",
            `Use the security-reviewer agent to review this code. ${prompt}`
        ),
        runAgent(
            "code-quality",
            `Use the code-quality agent to review this code. ${prompt}`
        ),
    ]);

    console.log("\n========== SECURITY REPORT ==========");
    console.log(securityReport);

    console.log("\n========== CODE QUALITY REPORT ==========");
    console.log(qualityReport);

    // Step 2 — pass both reports to fix-writer
    console.log("\n🔧 Step 2: Running fix-writer with both reports...");
    const fixReport = await runAgent(
        "fix-writer",
        `Use the fix-writer agent to fix src/app.js based on these reports.

SECURITY REPORT:
${securityReport}

CODE QUALITY REPORT:
${qualityReport}

The file is at src/app.js. Fix all reported issues and write the corrected file back to disk.`
    );

    console.log("\n========== FIX CHANGELOG ==========");
    console.log(fixReport);

    console.log("\n✅ All done. Check src/app.js for the rewritten file.");
}

main().catch(console.error);