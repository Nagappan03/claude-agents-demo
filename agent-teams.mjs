import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync, writeFileSync } from "fs";

const sourceCode = readFileSync("./src/app.js", "utf-8");

// Each agent gets its own session state — simulating independent context windows
const sessions = {
    coordinator: [],
    reviewer: [],
    reporter: [],
};

// Core function — each call is a fresh turn in that agent's own session
async function sendMessage(agentName, systemPrompt, userMessage) {
    console.log(`\n📨 [${agentName}] receiving message...`);
    const start = Date.now();

    sessions[agentName].push({ role: "user", content: userMessage });

    let response = "";

    for await (const message of query({
        prompt: userMessage,
        options: {
            allowedTools: ["Read", "Write", "Glob", "Grep"],
            systemPrompt,
            model: "claude-haiku-4-5-20251001",
        },
    })) {
        if (message.type === "assistant" && message.message?.content) {
            for (const block of message.message.content) {
                if (block.type === "text") {
                    response += block.text;
                }
            }
        }
    }

    sessions[agentName].push({ role: "assistant", content: response });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ [${agentName}] responded in ${elapsed}s`);
    return response;
}

// Agent system prompts — each agent has its own identity
const systemPrompts = {
    coordinator: `You are a coordinator agent managing a code review pipeline. 
Your job is to analyse the incoming code, break it into review areas, and produce 
a structured task list for the reviewer agent. Be concise and specific.`,

    reviewer: `You are a senior code reviewer. You receive a task list from the coordinator 
and a source file. Your job is to verify each task area and determine whether the 
code passes or fails each check. Be thorough but concise.`,

    reporter: `You are a technical report writer. You receive review findings and produce 
a clean, professional markdown report. Include an executive summary, a findings table, 
and a verdict. Use emoji sparingly.`,
};

async function main() {
    console.log("🚀 Agent Team Pipeline starting...\n");
    console.log("=".repeat(50));

    // ── Turn 1: Coordinator analyses the code ──
    console.log("\n📋 TURN 1: Coordinator analysing code...");
    const coordinatorOutput = await sendMessage(
        "coordinator",
        systemPrompts.coordinator,
        `Here is a source file that has been through a security and quality fix pass.
Analyse it and produce a structured task list of areas the reviewer should check.
Focus on: secrets handling, SQL safety, error handling, dead code, testability.

SOURCE FILE:
${sourceCode}`
    );

    console.log("\n--- Coordinator Output ---");
    console.log(coordinatorOutput);

    // ── Turn 2: Reviewer checks each task area ──
    console.log("\n🔍 TURN 2: Reviewer checking each task area...");
    const reviewerOutput = await sendMessage(
        "reviewer",
        systemPrompts.reviewer,
        `The coordinator has assigned you the following review tasks:

${coordinatorOutput}

Here is the source file to review:

${sourceCode}

Go through each task and give a PASS / FAIL / PARTIAL verdict with a one-line reason.`
    );

    console.log("\n--- Reviewer Output ---");
    console.log(reviewerOutput);

    // ── Turn 3: Coordinator reviews the findings and decides if re-review is needed ──
    console.log("\n🔄 TURN 3: Coordinator reviewing findings...");
    const coordinatorVerdict = await sendMessage(
        "coordinator",
        systemPrompts.coordinator,
        `The reviewer has returned these findings:

${reviewerOutput}

Are there any critical gaps or failures that need a follow-up review pass? 
Reply with either:
- APPROVED — if the review is complete and findings are sufficient
- REQUEST_REVISION: [specific gap] — if something important was missed`
    );

    console.log("\n--- Coordinator Verdict ---");
    console.log(coordinatorVerdict);

    // ── Turn 4: Reporter writes the final markdown report ──
    console.log("\n📝 TURN 4: Reporter writing final report...");
    const reporterOutput = await sendMessage(
        "reporter",
        systemPrompts.reporter,
        `Write a professional markdown report based on these inputs:

COORDINATOR TASK LIST:
${coordinatorOutput}

REVIEWER FINDINGS:
${reviewerOutput}

COORDINATOR VERDICT:
${coordinatorVerdict}

The report should include:
1. Executive Summary
2. Review Coverage Table (task | verdict | reason)
3. Key Findings
4. Final Verdict`
    );

    // Write report to disk
    writeFileSync("./review-report.md", reporterOutput);

    console.log("\n========== FINAL REPORT ==========");
    console.log(reporterOutput);
    console.log("\n✅ Report saved to review-report.md");

    // Show session sizes — proves each agent had its own independent context
    console.log("\n📊 Session turn counts (proves independent contexts):");
    for (const [agent, turns] of Object.entries(sessions)) {
        console.log(`  ${agent}: ${turns.length} turns`);
    }
}

main().catch(console.error);