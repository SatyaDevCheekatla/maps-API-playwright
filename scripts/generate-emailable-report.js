/**
 * Standalone Emailable HTML Report Generator
 * 
 * Generates a self-contained, single-file HTML report from Allure test results.
 * Zero external CSS/JS/fonts/CDN dependencies, zero CORS restrictions.
 * Designed to open seamlessly via file:// (double-click) or as an email attachment.
 */

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.resolve(process.cwd(), 'allure-results');
const REPORTS_DIR = path.resolve(process.cwd(), 'reports');
const REPORT_FILE = path.join(REPORTS_DIR, 'emailable-report.html');
const INDEX_FILE = path.join(REPORTS_DIR, 'index.html');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDuration(ms) {
  if (!ms || ms < 0) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(2);
  if (ms < 60000) return `${sec}s`;
  const min = Math.floor(ms / 60000);
  const remSec = ((ms % 60000) / 1000).toFixed(1);
  return `${min}m ${remSec}s`;
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: true,
  });
}

function parseEnvironment() {
  const envFile = path.join(RESULTS_DIR, 'environment.properties');
  const env = {
    ENVIRONMENT: process.env.ENVIRONMENT || 'development',
    BASE_URL: process.env.BASE_URL || 'https://rahulshettyacademy.com',
    NODE_VERSION: process.version,
    OS: process.platform,
    WORKERS: process.env.WORKERS || '2',
  };

  if (fs.existsSync(envFile)) {
    try {
      const content = fs.readFileSync(envFile, 'utf-8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          if (key) env[key] = val;
        }
      });
    } catch (e) {
      // Ignore env parsing error
    }
  }
  return env;
}

function readAttachmentContent(source) {
  if (!source) return null;
  const filePath = path.join(RESULTS_DIR, source);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (source.endsWith('.json')) {
      try {
        return JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        return raw;
      }
    }
    return raw;
  } catch {
    return null;
  }
}

function collectSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) return [];
  const steps = [];

  for (const step of rawSteps) {
    const attachments = [];
    if (Array.isArray(step.attachments)) {
      for (const att of step.attachments) {
        const content = readAttachmentContent(att.source);
        attachments.push({
          name: att.name,
          type: att.type,
          source: att.source,
          content,
        });
      }
    }

    const subSteps = collectSteps(step.steps);
    const duration = step.stop && step.start ? step.stop - step.start : 0;

    steps.push({
      name: step.name || 'Unnamed Step',
      status: step.status || 'passed',
      duration,
      durationFormatted: formatDuration(duration),
      attachments,
      steps: subSteps,
    });
  }

  return steps;
}

function getLatestSessionResults() {
  if (!fs.existsSync(RESULTS_DIR)) {
    console.error(`[Emailable Report] Allure results directory not found at: ${RESULTS_DIR}`);
    return [];
  }

  const resultFiles = fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('-result.json'));
  if (resultFiles.length === 0) {
    console.warn(`[Emailable Report] No *-result.json files found in: ${RESULTS_DIR}`);
    return [];
  }

  const allTests = [];
  for (const file of resultFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf-8'));
      allTests.push(data);
    } catch (err) {
      console.warn(`[Emailable Report] Skipping invalid JSON file: ${file}`);
    }
  }

  if (allTests.length === 0) return [];

  // Sort tests by stop timestamp descending
  allTests.sort((a, b) => (b.stop || 0) - (a.stop || 0));

  // Determine latest session: group tests where consecutive gap is <= 60 seconds
  const sessionTests = [allTests[0]];
  for (let i = 1; i < allTests.length; i++) {
    const prev = allTests[i - 1];
    const curr = allTests[i];
    const prevStop = prev.stop || 0;
    const currStop = curr.stop || 0;

    if (prevStop - currStop > 60000) {
      break; // Gap exceeds session window, stop clustering
    }
    sessionTests.push(curr);
  }

  // Deduplicate by testCaseId or fullName to ensure latest retry attempt
  const testMap = new Map();
  for (const t of sessionTests) {
    const key = t.testCaseId || t.fullName || t.name;
    if (!testMap.has(key)) {
      testMap.set(key, t);
    }
  }

  return Array.from(testMap.values());
}

function processTests(rawTests) {
  const processed = [];

  for (const t of rawTests) {
    const labels = t.labels || [];
    const getLabel = (name) => {
      const found = labels.find((l) => l.name === name);
      return found ? found.value : null;
    };

    const suite = getLabel('suite') || 'General Suite';
    const subSuite = getLabel('subSuite') || '';
    const epic = getLabel('epic') || 'Maps API';
    const feature = getLabel('feature') || 'API Verification';
    const story = getLabel('story') || '';
    const severity = getLabel('severity') || 'normal';

    const tags = labels
      .filter((l) => l.name === 'tag')
      .map((l) => l.value);

    // Root-level attachments (e.g. stdout)
    const rootAttachments = [];
    if (Array.isArray(t.attachments)) {
      for (const att of t.attachments) {
        const content = readAttachmentContent(att.source);
        rootAttachments.push({
          name: att.name,
          type: att.type,
          source: att.source,
          content,
        });
      }
    }

    const steps = collectSteps(t.steps);
    const duration = t.stop && t.start ? t.stop - t.start : 0;

    processed.push({
      uuid: t.uuid,
      name: t.name || 'Unnamed Test',
      fullName: t.fullName || t.name,
      status: t.status || 'unknown',
      duration,
      durationFormatted: formatDuration(duration),
      start: t.start,
      stop: t.stop,
      startDate: formatDate(t.start),
      stopDate: formatDate(t.stop),
      suite,
      subSuite,
      epic,
      feature,
      story,
      severity,
      tags,
      statusDetails: t.statusDetails || {},
      steps,
      rootAttachments,
    });
  }

  // Sort by start timestamp ascending
  processed.sort((a, b) => (a.start || 0) - (b.start || 0));
  return processed;
}

function buildDonutSvg(passed, failed, skipped, total) {
  if (total === 0) return '';
  const size = 120;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const passedPct = passed / total;
  const failedPct = failed / total;
  const skippedPct = skipped / total;

  const passedOffset = 0;
  const failedOffset = passedPct * circumference;
  const skippedOffset = (passedPct + failedPct) * circumference;

  const passedDash = `${passedPct * circumference} ${circumference}`;
  const failedDash = `${failedPct * circumference} ${circumference}`;
  const skippedDash = `${skippedPct * circumference} ${circumference}`;

  const pctDisplay = Math.round(passedPct * 100);

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-chart">
      <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="${strokeWidth}" />
      ${
        passed > 0
          ? `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#10b981" stroke-width="${strokeWidth}"
             stroke-dasharray="${passedDash}" stroke-dashoffset="-${passedOffset}" transform="rotate(-90 ${size / 2} ${size / 2})" />`
          : ''
      }
      ${
        failed > 0
          ? `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#ef4444" stroke-width="${strokeWidth}"
             stroke-dasharray="${failedDash}" stroke-dashoffset="-${failedOffset}" transform="rotate(-90 ${size / 2} ${size / 2})" />`
          : ''
      }
      ${
        skipped > 0
          ? `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#f59e0b" stroke-width="${strokeWidth}"
             stroke-dasharray="${skippedDash}" stroke-dashoffset="-${skippedOffset}" transform="rotate(-90 ${size / 2} ${size / 2})" />`
          : ''
      }
      <text x="50%" y="48%" text-anchor="middle" font-size="22" font-weight="700" fill="#0f172a" dy=".3em">${pctDisplay}%</text>
      <text x="50%" y="68%" text-anchor="middle" font-size="11" font-weight="500" fill="#64748b">PASS RATE</text>
    </svg>
  `;
}

function renderHtmlReport(tests, env) {
  const total = tests.length;
  const passed = tests.filter((t) => t.status === 'passed').length;
  const failed = tests.filter((t) => t.status === 'failed').length;
  const broken = tests.filter((t) => t.status === 'broken').length;
  const skipped = tests.filter((t) => t.status === 'skipped').length;
  const totalFailed = failed + broken;

  const minStart = tests.reduce((min, t) => Math.min(min, t.start || Infinity), Infinity);
  const maxStop = tests.reduce((max, t) => Math.max(max, t.stop || 0), 0);
  const totalDuration = maxStop > minStart ? maxStop - minStart : tests.reduce((sum, t) => sum + t.duration, 0);

  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';
  const overallStatus = totalFailed === 0 && total > 0 ? 'PASSED' : 'FAILED';
  const overallColor = overallStatus === 'PASSED' ? '#10b981' : '#ef4444';

  // Group tests by Suite
  const suitesMap = new Map();
  for (const t of tests) {
    const s = t.suite || 'General';
    if (!suitesMap.has(s)) suitesMap.set(s, []);
    suitesMap.get(s).push(t);
  }

  const donutSvg = buildDonutSvg(passed, totalFailed, skipped, total);

  // Render Suite Summary Rows
  const suiteSummaryRows = Array.from(suitesMap.entries())
    .map(([suiteName, suiteTests]) => {
      const sTotal = suiteTests.length;
      const sPassed = suiteTests.filter((t) => t.status === 'passed').length;
      const sFailed = suiteTests.filter((t) => t.status === 'failed' || t.status === 'broken').length;
      const sDuration = suiteTests.reduce((acc, t) => acc + t.duration, 0);
      const sPassRate = sTotal > 0 ? ((sPassed / sTotal) * 100).toFixed(0) : '0';

      return `
        <tr>
          <td class="font-semibold">${escapeHtml(suiteName)}</td>
          <td class="text-center">${sTotal}</td>
          <td class="text-center text-success font-semibold">${sPassed}</td>
          <td class="text-center text-danger font-semibold">${sFailed}</td>
          <td class="text-center">${formatDuration(sDuration)}</td>
          <td class="text-center">
            <span class="badge ${sFailed === 0 ? 'badge-success' : 'badge-danger'}">${sPassRate}%</span>
          </td>
        </tr>
      `;
    })
    .join('');

  // Render Test Cards
  const testCardsHtml = tests
    .map((test, index) => {
      const statusClass = test.status === 'passed' ? 'status-passed' : 'status-failed';
      const badgeClass =
        test.status === 'passed'
          ? 'badge-success'
          : test.status === 'failed' || test.status === 'broken'
            ? 'badge-danger'
            : 'badge-warning';

      // Find API request/response attachments across steps
      function findApiAttachments(steps) {
        const atts = [];
        for (const s of steps) {
          for (const a of s.attachments || []) {
            if (a.name.includes('HTTP') || a.name.includes('Request') || a.name.includes('Response')) {
              atts.push(a);
            }
          }
          if (s.steps && s.steps.length > 0) {
            atts.push(...findApiAttachments(s.steps));
          }
        }
        return atts;
      }

      const apiAttachments = findApiAttachments(test.steps);

      // Render Step Tree
      function renderSteps(stepList, depth = 0) {
        if (!stepList || stepList.length === 0) return '';
        return stepList
          .map((step) => {
            const stepStatus = step.status === 'passed' ? 'step-passed' : 'step-failed';
            const icon = step.status === 'passed' ? '✔' : '✖';
            const attsHtml = (step.attachments || [])
              .map(
                (att, aIdx) => `
                  <div class="attachment-block">
                    <div class="attachment-header" onclick="toggleAttachment('${test.uuid}-step-${index}-${depth}-${aIdx}')">
                      <span class="attachment-title">📎 ${escapeHtml(att.name)}</span>
                      <span class="attachment-type">${escapeHtml(att.type || 'text')}</span>
                    </div>
                    <pre id="${test.uuid}-step-${index}-${depth}-${aIdx}" class="attachment-content hidden">${escapeHtml(att.content || '(empty payload)')}</pre>
                  </div>
                `,
              )
              .join('');

            const subStepsHtml = renderSteps(step.steps, depth + 1);

            return `
              <div class="step-item ${stepStatus}" style="margin-left: ${depth * 16}px">
                <div class="step-header">
                  <span class="step-icon">${icon}</span>
                  <span class="step-name">${escapeHtml(step.name)}</span>
                  <span class="step-duration">${step.durationFormatted}</span>
                </div>
                ${attsHtml}
                ${subStepsHtml}
              </div>
            `;
          })
          .join('');
      }

      const stepsHtml = renderSteps(test.steps);

      // Render Failure Diagnostics
      let failureHtml = '';
      if (test.status === 'failed' || test.status === 'broken') {
        failureHtml = `
          <div class="error-diagnostic-box">
            <div class="error-title">🚨 Assertion Failure / Error Diagnostics</div>
            <pre class="error-message">${escapeHtml(test.statusDetails.message || 'Test failed without specific message')}</pre>
            ${
              test.statusDetails.trace
                ? `<div class="error-trace-title">Stack Trace:</div><pre class="error-trace">${escapeHtml(test.statusDetails.trace)}</pre>`
                : ''
            }
          </div>
        `;
      }

      // Render API Quick View (if HTTP attachments present)
      let apiQuickViewHtml = '';
      if (apiAttachments.length > 0) {
        const payloadBoxes = apiAttachments
          .map(
            (att, attIdx) => `
              <div class="api-payload-box">
                <div class="api-payload-header" onclick="toggleAttachment('att-${test.uuid}-${attIdx}')">
                  <span class="api-payload-name">⚡ ${escapeHtml(att.name)}</span>
                  <span class="toggle-link">Toggle Details ▾</span>
                </div>
                <pre id="att-${test.uuid}-${attIdx}" class="api-payload-body hidden">${escapeHtml(att.content || '')}</pre>
              </div>
            `,
          )
          .join('');

        apiQuickViewHtml = `
          <div class="api-attachments-section">
            <div class="section-subtitle">API Request & Response Payload Payloads (${apiAttachments.length})</div>
            ${payloadBoxes}
          </div>
        `;
      }

      // Root attachments (e.g. stdout)
      let rootAttsHtml = '';
      if (test.rootAttachments.length > 0) {
        rootAttsHtml = test.rootAttachments
          .map(
            (att, rIdx) => `
              <div class="attachment-block">
                <div class="attachment-header" onclick="toggleAttachment('root-att-${test.uuid}-${rIdx}')">
                  <span class="attachment-title">📄 ${escapeHtml(att.name)}</span>
                  <span class="attachment-type">${escapeHtml(att.type || 'text/plain')}</span>
                </div>
                <pre id="root-att-${test.uuid}-${rIdx}" class="attachment-content hidden">${escapeHtml(att.content || '')}</pre>
              </div>
            `,
          )
          .join('');
      }

      const tagsPills = (test.tags || [])
        .map((tag) => `<span class="tag-pill">#${escapeHtml(tag)}</span>`)
        .join(' ');

      return `
        <div class="test-card ${statusClass}" data-status="${test.status}" data-suite="${escapeHtml(test.suite)}" data-name="${escapeHtml(test.name.toLowerCase())}">
          <div class="test-header" onclick="toggleTestDetails('${test.uuid}')">
            <div class="test-header-left">
              <span class="badge ${badgeClass}">${test.status.toUpperCase()}</span>
              <span class="test-title">${escapeHtml(test.name)}</span>
            </div>
            <div class="test-header-right">
              <span class="suite-pill">${escapeHtml(test.suite)}</span>
              <span class="duration-badge">⏱ ${test.durationFormatted}</span>
              <span class="toggle-arrow" id="arrow-${test.uuid}">▼</span>
            </div>
          </div>

          <div id="details-${test.uuid}" class="test-details hidden">
            <div class="test-meta-grid">
              <div><strong>Suite:</strong> ${escapeHtml(test.suite)} ${test.subSuite ? `&gt; ${escapeHtml(test.subSuite)}` : ''}</div>
              <div><strong>Severity:</strong> <span class="severity-pill">${escapeHtml(test.severity)}</span></div>
              <div><strong>Epic:</strong> ${escapeHtml(test.epic)}</div>
              <div><strong>Feature:</strong> ${escapeHtml(test.feature)}</div>
              ${test.story ? `<div><strong>Story:</strong> ${escapeHtml(test.story)}</div>` : ''}
              <div><strong>Execution Time:</strong> ${test.startDate} (${test.durationFormatted})</div>
            </div>
            ${tagsPills ? `<div class="test-tags">${tagsPills}</div>` : ''}

            ${failureHtml}
            ${apiQuickViewHtml}

            <div class="test-steps-section">
              <div class="section-subtitle">Execution Steps & Assertions</div>
              ${stepsHtml || '<div class="no-steps">No granular steps recorded</div>'}
            </div>

            ${
              rootAttsHtml
                ? `
              <div class="test-logs-section">
                <div class="section-subtitle">Execution Logs (stdout)</div>
                ${rootAttsHtml}
              </div>
            `
                : ''
            }
          </div>
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Playwright Maps API - Test Execution Report</title>
  <style>
    /* =====================================================================
       STANDALONE EMAILABLE ALLURE REPORT STYLES
       Zero External Dependencies - 100% Offline Compatible & Email Friendly
       ===================================================================== */
    :root {
      --bg-primary: #f8fafc;
      --bg-card: #ffffff;
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --text-muted: #94a3b8;
      --border-color: #e2e8f0;
      --color-success: #10b981;
      --color-success-light: #ecfdf5;
      --color-danger: #ef4444;
      --color-danger-light: #fef2f2;
      --color-warning: #f59e0b;
      --color-warning-light: #fffbeb;
      --color-info: #0284c7;
      --color-indigo: #6366f1;
      --radius-sm: 6px;
      --radius-md: 10px;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04);
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-family);
      font-size: 14px;
      line-height: 1.5;
      padding: 24px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Executive Header */
    .header-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 28px 32px;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      margin-bottom: 24px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .header-title-box h1 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
    }
    .header-title-box p {
      color: #94a3b8;
      font-size: 13px;
    }
    .header-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .status-pill-large {
      padding: 6px 16px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: ${overallColor};
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .env-pill {
      background: rgba(255,255,255,0.12);
      color: #e2e8f0;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 12px;
    }

    /* Summary Dashboard */
    .dashboard-grid {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }
    @media (max-width: 860px) {
      .dashboard-grid { grid-template-columns: 1fr; }
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      padding: 20px;
    }

    .donut-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .donut-chart {
      margin-bottom: 12px;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 14px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 14px;
      text-align: center;
    }
    .kpi-val {
      font-size: 26px;
      font-weight: 700;
      line-height: 1.1;
      margin-bottom: 4px;
    }
    .kpi-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .val-total { color: var(--color-indigo); }
    .val-passed { color: var(--color-success); }
    .val-failed { color: var(--color-danger); }
    .val-skipped { color: var(--color-warning); }

    .env-meta-box {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px dashed var(--border-color);
      font-size: 12px;
      color: var(--text-secondary);
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      justify-content: space-between;
    }

    /* Suite Summary Table */
    .table-container {
      margin-bottom: 24px;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      color: var(--text-secondary);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    tr:last-child td { border-bottom: none; }
    .text-center { text-align: center; }
    .font-semibold { font-weight: 600; }
    .text-success { color: var(--color-success); }
    .text-danger { color: var(--color-danger); }

    /* Filters & Search Toolbar */
    .toolbar {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 14px 18px;
      margin-bottom: 20px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .filter-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .filter-btn {
      background: #f1f5f9;
      border: 1px solid var(--border-color);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .filter-btn:hover { background: #e2e8f0; color: var(--text-primary); }
    .filter-btn.active {
      background: #0f172a;
      color: #ffffff;
      border-color: #0f172a;
    }
    .search-box input {
      border: 1px solid var(--border-color);
      padding: 7px 14px;
      border-radius: 9999px;
      font-size: 12px;
      width: 240px;
      outline: none;
      background: #f8fafc;
    }
    .search-box input:focus {
      border-color: var(--color-indigo);
      background: #ffffff;
    }
    .action-btn {
      background: #ffffff;
      border: 1px solid var(--border-color);
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .action-btn:hover { background: #f8fafc; }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .badge-success { background: var(--color-success-light); color: var(--color-success); border: 1px solid rgba(16,185,129,0.2); }
    .badge-danger { background: var(--color-danger-light); color: var(--color-danger); border: 1px solid rgba(239,68,68,0.2); }
    .badge-warning { background: var(--color-warning-light); color: var(--color-warning); border: 1px solid rgba(245,158,11,0.2); }
    .suite-pill {
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: var(--font-mono);
    }
    .duration-badge {
      font-size: 12px;
      color: var(--text-secondary);
      font-weight: 500;
    }
    .severity-pill {
      background: #e0e7ff;
      color: #4338ca;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .tag-pill {
      background: #f1f5f9;
      color: #3b82f6;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
    }

    /* Test Cards */
    .test-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .test-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      transition: border-color 0.15s ease;
    }
    .test-card:hover { border-color: #cbd5e1; }
    .test-card.status-passed { border-left: 4px solid var(--color-success); }
    .test-card.status-failed { border-left: 4px solid var(--color-danger); }

    .test-header {
      padding: 14px 18px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      user-select: none;
    }
    .test-header:hover { background: #f8fafc; }
    .test-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 280px;
    }
    .test-title {
      font-weight: 600;
      font-size: 14px;
      color: var(--text-primary);
    }
    .test-header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .toggle-arrow {
      font-size: 10px;
      color: var(--text-muted);
      transition: transform 0.2s ease;
    }
    .toggle-arrow.rotated { transform: rotate(180deg); }

    .test-details {
      padding: 16px 20px 20px;
      border-top: 1px solid var(--border-color);
      background: #fafafa;
    }
    .hidden { display: none !important; }

    .test-meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px 16px;
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 14px;
      background: #ffffff;
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-color);
    }
    .test-tags {
      margin-bottom: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .section-subtitle {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-secondary);
      margin: 16px 0 8px;
    }

    /* Error Diagnostics */
    .error-diagnostic-box {
      background: var(--color-danger-light);
      border: 1px solid rgba(239,68,68,0.3);
      border-radius: var(--radius-sm);
      padding: 14px;
      margin-bottom: 16px;
    }
    .error-title {
      font-weight: 700;
      color: #b91c1c;
      font-size: 13px;
      margin-bottom: 6px;
    }
    .error-message {
      font-family: var(--font-mono);
      font-size: 12px;
      color: #7f1d1d;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .error-trace-title {
      font-size: 11px;
      font-weight: 600;
      color: #991b1b;
      margin: 10px 0 4px;
    }
    .error-trace {
      font-family: var(--font-mono);
      font-size: 11px;
      color: #991b1b;
      background: rgba(255,255,255,0.7);
      padding: 8px;
      border-radius: 4px;
      max-height: 180px;
      overflow-y: auto;
      white-space: pre-wrap;
    }

    /* API Payloads */
    .api-attachments-section { margin-bottom: 14px; }
    .api-payload-box {
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      background: #ffffff;
      margin-bottom: 8px;
      overflow: hidden;
    }
    .api-payload-header {
      padding: 8px 12px;
      background: #f1f5f9;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    }
    .api-payload-name { color: #1e293b; }
    .toggle-link { font-size: 11px; color: var(--color-indigo); }
    .api-payload-body {
      padding: 12px;
      background: #0f172a;
      color: #f8fafc;
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-x: auto;
      max-height: 280px;
      line-height: 1.4;
    }

    /* Steps */
    .step-item {
      padding: 6px 10px;
      border-left: 2px solid #cbd5e1;
      margin-bottom: 6px;
      font-size: 12px;
    }
    .step-item.step-passed { border-left-color: var(--color-success); }
    .step-item.step-failed { border-left-color: var(--color-danger); }
    .step-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .step-icon {
      font-size: 11px;
      font-weight: bold;
    }
    .step-passed .step-icon { color: var(--color-success); }
    .step-failed .step-icon { color: var(--color-danger); }
    .step-name { flex: 1; color: var(--text-primary); }
    .step-duration { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }

    /* Attachments */
    .attachment-block {
      margin-top: 6px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: #ffffff;
    }
    .attachment-header {
      padding: 6px 10px;
      font-size: 11px;
      background: #f8fafc;
      display: flex;
      justify-content: space-between;
      cursor: pointer;
    }
    .attachment-title { font-weight: 500; color: #334155; }
    .attachment-type { color: var(--text-muted); font-family: var(--font-mono); }
    .attachment-content {
      padding: 10px;
      background: #0f172a;
      color: #f1f5f9;
      font-family: var(--font-mono);
      font-size: 11px;
      overflow-x: auto;
      max-height: 240px;
      white-space: pre-wrap;
    }

    /* Footer */
    .footer {
      margin-top: 32px;
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      padding: 16px;
      border-top: 1px solid var(--border-color);
    }

    /* Print / PDF Media */
    @media print {
      body { background: #ffffff; padding: 0; }
      .header-banner { background: #0f172a !important; color: #ffffff !important; -webkit-print-color-adjust: exact; }
      .toolbar, .toggle-link, .action-btn { display: none !important; }
      .test-details { display: block !important; }
      .api-payload-body, .attachment-content { display: block !important; max-height: none !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Executive Header Banner -->
    <header class="header-banner">
      <div class="header-title-box">
        <h1>Google Maps API Test Automation Report</h1>
        <p>Enterprise Playwright + TypeScript Suite Execution Results</p>
      </div>
      <div class="header-badges">
        <span class="status-pill-large">${overallStatus}</span>
        <span class="env-pill">ENV: ${escapeHtml(env.ENVIRONMENT || 'dev')}</span>
        <span class="env-pill">WORKERS: ${escapeHtml(env.WORKERS || '2')}</span>
      </div>
    </header>

    <!-- Metrics Dashboard -->
    <section class="dashboard-grid">
      <!-- Visual Donut Chart Card -->
      <div class="card donut-card">
        ${donutSvg}
        <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
          ${passed} of ${total} tests passed (${passRate}%)
        </div>
      </div>

      <!-- KPI Numbers Card -->
      <div class="card">
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-val val-total">${total}</div>
            <div class="kpi-label">Total Tests</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val val-passed">${passed}</div>
            <div class="kpi-label">Passed</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val val-failed">${totalFailed}</div>
            <div class="kpi-label">Failed</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val val-skipped">${skipped}</div>
            <div class="kpi-label">Skipped</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val" style="color: #0284c7;">${formatDuration(totalDuration)}</div>
            <div class="kpi-label">Duration</div>
          </div>
        </div>

        <div class="env-meta-box">
          <div><strong>Base URL:</strong> ${escapeHtml(env.BASE_URL)}</div>
          <div><strong>Node Version:</strong> ${escapeHtml(env.NODE_VERSION)}</div>
          <div><strong>Platform:</strong> ${escapeHtml(env.OS)}</div>
          <div><strong>Execution Run:</strong> ${formatDate(minStart)}</div>
        </div>
      </div>
    </section>

    <!-- Suite Summary Table -->
    <div class="card table-container">
      <div class="section-subtitle" style="margin-top: 0; margin-bottom: 12px;">Test Suite Breakdown</div>
      <table>
        <thead>
          <tr>
            <th>Suite / Specification</th>
            <th class="text-center">Total</th>
            <th class="text-center">Passed</th>
            <th class="text-center">Failed</th>
            <th class="text-center">Duration</th>
            <th class="text-center">Pass Rate</th>
          </tr>
        </thead>
        <tbody>
          ${suiteSummaryRows}
        </tbody>
      </table>
    </div>

    <!-- Filters & Search Toolbar -->
    <div class="toolbar">
      <div class="filter-group">
        <button class="filter-btn active" onclick="filterTests('all', this)">All (${total})</button>
        <button class="filter-btn" onclick="filterTests('passed', this)">Passed (${passed})</button>
        ${
          totalFailed > 0
            ? `<button class="filter-btn" style="color: #ef4444;" onclick="filterTests('failed', this)">Failed (${totalFailed})</button>`
            : ''
        }
        ${
          skipped > 0
            ? `<button class="filter-btn" style="color: #f59e0b;" onclick="filterTests('skipped', this)">Skipped (${skipped})</button>`
            : ''
        }
      </div>

      <div class="search-box">
        <input type="text" id="searchInput" placeholder="Search tests or tags..." onkeyup="searchTests()">
      </div>

      <div style="display: flex; gap: 8px;">
        <button class="action-btn" onclick="expandAll()">Expand All</button>
        <button class="action-btn" onclick="collapseAll()">Collapse All</button>
        <button class="action-btn" onclick="window.print()">Print / PDF</button>
      </div>
    </div>

    <!-- Test Cases Accordion List -->
    <section class="test-list" id="testList">
      ${testCardsHtml}
    </section>

    <!-- Footer -->
    <footer class="footer">
      Generated automatically by Playwright Maps API Test Automation Framework &bull; Standalone Emailable Report (No External Dependencies)
    </footer>
  </div>

  <script>
    /* Inlined Interactive Behavior */
    function toggleTestDetails(uuid) {
      const details = document.getElementById('details-' + uuid);
      const arrow = document.getElementById('arrow-' + uuid);
      if (!details) return;
      if (details.classList.contains('hidden')) {
        details.classList.remove('hidden');
        if (arrow) arrow.classList.add('rotated');
      } else {
        details.classList.add('hidden');
        if (arrow) arrow.classList.remove('rotated');
      }
    }

    function toggleAttachment(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('hidden');
    }

    function filterTests(status, btn) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');

      const cards = document.querySelectorAll('.test-card');
      cards.forEach(card => {
        const cardStatus = card.getAttribute('data-status');
        if (status === 'all' || cardStatus === status) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }

    function searchTests() {
      const query = document.getElementById('searchInput').value.toLowerCase().trim();
      const cards = document.querySelectorAll('.test-card');

      cards.forEach(card => {
        const name = card.getAttribute('data-name') || '';
        const suite = (card.getAttribute('data-suite') || '').toLowerCase();
        if (!query || name.includes(query) || suite.includes(query)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }

    function expandAll() {
      document.querySelectorAll('.test-details').forEach(el => el.classList.remove('hidden'));
      document.querySelectorAll('.toggle-arrow').forEach(el => el.classList.add('rotated'));
      document.querySelectorAll('.api-payload-body').forEach(el => el.classList.remove('hidden'));
    }

    function collapseAll() {
      document.querySelectorAll('.test-details').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.toggle-arrow').forEach(el => el.classList.remove('rotated'));
      document.querySelectorAll('.api-payload-body').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.attachment-content').forEach(el => el.classList.add('hidden'));
    }
  </script>
</body>
</html>
`;
}

function main() {
  console.log('[Emailable Report] Reading test results from allure-results...');

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const latestTests = getLatestSessionResults();
  if (latestTests.length === 0) {
    console.warn('[Emailable Report] No test results available to generate report.');
    return;
  }

  console.log(`[Emailable Report] Found ${latestTests.length} tests from the latest run session.`);
  const env = parseEnvironment();
  const processedTests = processTests(latestTests);

  const html = renderHtmlReport(processedTests, env);

  fs.writeFileSync(REPORT_FILE, html, 'utf-8');
  fs.writeFileSync(INDEX_FILE, html, 'utf-8');

  const passed = processedTests.filter((t) => t.status === 'passed').length;
  const failed = processedTests.filter((t) => t.status === 'failed' || t.status === 'broken').length;

  console.log('===============================================================');
  console.log(' 🎉 EMAILABLE STANDALONE REPORT GENERATED SUCCESSFULLY');
  console.log('===============================================================');
  console.log(` Location:     ${REPORT_FILE}`);
  console.log(` Web Index:    ${INDEX_FILE}`);
  console.log(` Total Tests:  ${processedTests.length}`);
  console.log(` Passed:       ${passed}`);
  console.log(` Failed:       ${failed}`);
  console.log(` File Size:    ${(Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)} KB`);
  console.log('===============================================================');
  console.log(' 💡 This file is 100% self-contained. You can:');
  console.log('    1. Double-click reports/emailable-report.html to view directly in browser.');
  console.log('    2. Attach reports/emailable-report.html directly to any email.');
  console.log('    3. No CORS errors, no local server needed!');
  console.log('===============================================================');
}

main();
