"""HTML widget for GST 2B Reconciliation - Professional dark theme."""

GST2B_WIDGET_HTML = r'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GST 2B Reconciliation</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0a0e1a;
            --bg-card: rgba(17, 24, 39, 0.7);
            --bg-glass: rgba(255,255,255,0.03);
            --border: rgba(255,255,255,0.06);
            --border-hover: rgba(99,102,241,0.4);
            --text-primary: #f1f5f9;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --accent: #6366f1;
            --accent-light: #818cf8;
            --accent-glow: rgba(99,102,241,0.15);
            --success: #10b981;
            --success-glow: rgba(16,185,129,0.15);
            --warning: #f59e0b;
            --danger: #ef4444;
            --info: #3b82f6;
            --radius-md: 12px;
            --radius-lg: 16px;
            --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-primary); color: var(--text-primary);
            min-height: 100vh; -webkit-font-smoothing: antialiased;
        }
        .bg-gradient {
            position: fixed; inset: 0; z-index: 0; pointer-events: none;
            background:
                radial-gradient(ellipse 80% 60% at 10% 0%, rgba(99,102,241,0.08) 0%, transparent 60%),
                radial-gradient(ellipse 60% 50% at 90% 100%, rgba(16,185,129,0.05) 0%, transparent 50%);
        }
        .grid-overlay {
            position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.03;
            background-image:
                linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
            background-size: 60px 60px;
        }
        .container { position: relative; z-index: 1; max-width: 720px; margin: 0 auto; padding: 40px 24px 80px; }

        /* Nav */
        .nav { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; animation: fadeDown 0.5s ease-out; }
        .nav-back {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 7px 14px; border-radius: 8px;
            background: var(--bg-glass); border: 1px solid var(--border);
            color: var(--text-muted); font-size: 12px; font-weight: 600;
            text-decoration: none; transition: all var(--transition);
        }
        .nav-back:hover { border-color: var(--border-hover); color: var(--accent-light); }

        /* Header */
        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 36px; animation: fadeDown 0.6s ease-out; }
        .header-icon {
            width: 52px; height: 52px; border-radius: var(--radius-md);
            background: linear-gradient(135deg, #3b82f6, #6366f1);
            display: flex; align-items: center; justify-content: center;
            font-size: 24px; box-shadow: 0 8px 24px rgba(59,130,246,0.3); flex-shrink: 0;
        }
        .header-text h1 {
            font-size: 22px; font-weight: 800; letter-spacing: -0.5px;
            background: linear-gradient(135deg, #bfdbfe, #c7d2fe);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .header-text p { font-size: 13px; color: var(--text-muted); font-weight: 500; margin-top: 2px; }
        .header-badge {
            margin-left: auto; padding: 5px 14px; border-radius: 20px;
            background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.2);
            font-size: 11px; font-weight: 700; color: #93c5fd; letter-spacing: 0.06em; text-transform: uppercase;
        }

        /* Section label */
        .section-label {
            display: flex; align-items: center; gap: 10px; margin: 28px 0 16px;
            animation: fadeDown 0.6s ease-out;
        }
        .section-label span { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; }
        .section-label .line { flex: 1; height: 1px; background: linear-gradient(90deg, var(--border), transparent); }
        .tag { padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; }
        .tag-required { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }

        /* Upload card */
        .upload-card {
            background: var(--bg-card); border: 1px solid var(--border);
            border-radius: var(--radius-lg); backdrop-filter: blur(12px);
            transition: all var(--transition); overflow: hidden;
            margin-bottom: 16px; animation: fadeUp 0.5s ease-out both;
        }
        .upload-card:nth-child(1) { animation-delay: 0.05s; }
        .upload-card:nth-child(2) { animation-delay: 0.1s; }
        .upload-card:hover { border-color: var(--border-hover); box-shadow: 0 0 40px rgba(99,102,241,0.08); transform: translateY(-2px); }
        .upload-card.has-file { border-color: rgba(16,185,129,0.35); background: rgba(16,185,129,0.04); }
        .drop-zone {
            position: relative; padding: 28px 20px 22px; text-align: center;
            cursor: pointer; transition: all var(--transition);
        }
        .drop-zone.dragover { background: var(--accent-glow); }
        .drop-zone input[type="file"] { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .drop-icon {
            width: 48px; height: 48px; border-radius: var(--radius-md);
            background: var(--bg-glass); border: 1px solid var(--border);
            display: flex; align-items: center; justify-content: center;
            font-size: 22px; margin: 0 auto 12px; transition: all var(--transition);
        }
        .upload-card:hover .drop-icon { border-color: var(--border-hover); background: var(--accent-glow); }
        .upload-card.has-file .drop-icon { border-color: rgba(16,185,129,0.3); background: var(--success-glow); }
        .drop-label { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .drop-hint { font-size: 11px; color: var(--text-muted); }
        .drop-filename {
            font-size: 11px; color: var(--success); font-weight: 600; margin-top: 8px;
            display: none; align-items: center; justify-content: center; gap: 5px;
        }
        .drop-filename::before { content: '\2713'; font-size: 13px; }
        .card-footer { display: flex; border-top: 1px solid var(--border); }
        .sample-btn {
            flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
            padding: 10px; font-size: 11px; font-weight: 600; color: var(--text-muted);
            text-decoration: none; transition: all var(--transition); background: transparent;
        }
        .sample-btn:hover { color: var(--accent-light); background: var(--accent-glow); }
        .sample-btn svg { width: 14px; height: 14px; }

        /* Run button */
        .run-section { margin-top: 28px; animation: fadeUp 0.5s ease-out 0.2s both; }
        .run-btn {
            width: 100%; padding: 18px 24px; border: none; border-radius: var(--radius-lg);
            font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 700;
            color: #fff; cursor: pointer;
            background: linear-gradient(135deg, #3b82f6, #6366f1, #3b82f6);
            background-size: 200% 200%;
            box-shadow: 0 8px 32px rgba(59,130,246,0.35);
            transition: all var(--transition);
            display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .run-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(59,130,246,0.5); background-position: 100% 0; }
        .run-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; transform: none; }
        .run-btn svg { width: 18px; height: 18px; }

        /* Loading */
        #loading { display: none; margin-top: 28px; animation: fadeUp 0.4s ease-out; }
        .progress-card {
            background: var(--bg-card); border: 1px solid var(--border);
            border-radius: var(--radius-lg); padding: 28px 24px; text-align: center;
            backdrop-filter: blur(12px);
        }
        .spinner {
            width: 44px; height: 44px; border-radius: 50%; margin: 0 auto 16px;
            border: 3px solid rgba(59,130,246,0.15); border-top-color: #3b82f6;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .loading-sub { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

        /* Result */
        #result { display: none; margin-top: 28px; animation: fadeUp 0.5s ease-out; }
        .result-header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
        .result-check {
            width: 44px; height: 44px; border-radius: 50%;
            background: linear-gradient(135deg, #10b981, #059669);
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; color: #fff; box-shadow: 0 6px 20px rgba(16,185,129,0.3); flex-shrink: 0;
        }
        .result-header h2 { font-size: 18px; font-weight: 800; color: #d1fae5; }
        .result-header p { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

        /* Stats */
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
        .stat-card {
            border-radius: var(--radius-md); padding: 16px 18px;
            border: 1px solid transparent;
        }
        .stat-card.green  { background: rgba(16,185,129,0.06); border-color: rgba(16,185,129,0.15); }
        .stat-card.amber  { background: rgba(245,158,11,0.06); border-color: rgba(245,158,11,0.15); }
        .stat-card.red    { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.15); }
        .stat-card.blue   { background: rgba(59,130,246,0.06); border-color: rgba(59,130,246,0.15); }
        .stat-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .stat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .green .stat-dot { background: var(--success); box-shadow: 0 0 8px rgba(16,185,129,0.4); }
        .amber .stat-dot { background: var(--warning); box-shadow: 0 0 8px rgba(245,158,11,0.3); }
        .red .stat-dot   { background: var(--danger); box-shadow: 0 0 8px rgba(239,68,68,0.3); }
        .blue .stat-dot  { background: var(--info); box-shadow: 0 0 8px rgba(59,130,246,0.3); }
        .stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
        .stat-count { font-size: 28px; font-weight: 900; font-variant-numeric: tabular-nums; margin-bottom: 4px; }
        .green .stat-count { color: #6ee7b7; } .amber .stat-count { color: #fcd34d; }
        .red .stat-count   { color: #fca5a5; } .blue .stat-count  { color: #93c5fd; }
        .stat-amount { font-size: 11px; color: var(--text-muted); line-height: 1.6; }

        /* Meta row */
        .meta-row {
            display: flex; justify-content: center; gap: 40px;
            padding: 12px; margin-bottom: 20px;
            background: var(--bg-glass); border: 1px solid var(--border);
            border-radius: var(--radius-md);
        }
        .meta-item { text-align: center; }
        .meta-val { font-size: 16px; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; }
        .meta-lbl { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
        .meta-divider { width: 1px; background: var(--border); }

        /* Download */
        .dl-btn {
            width: 100%; padding: 16px 24px; border: none; border-radius: var(--radius-lg);
            font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 700;
            color: #fff; cursor: pointer;
            background: linear-gradient(135deg, #10b981, #059669);
            box-shadow: 0 8px 28px rgba(16,185,129,0.3);
            display: flex; align-items: center; justify-content: center; gap: 10px;
            text-decoration: none; transition: all var(--transition);
        }
        .dl-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 36px rgba(16,185,129,0.4); }
        .dl-btn svg { width: 18px; height: 18px; }

        /* Error */
        .err-card {
            background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
            border-radius: var(--radius-lg); padding: 24px;
            display: flex; gap: 16px; align-items: flex-start;
        }
        .err-icon { font-size: 28px; flex-shrink: 0; }
        .err-title { font-size: 14px; font-weight: 700; color: #fca5a5; margin-bottom: 6px; }
        .err-msg { font-size: 13px; color: #f87171; line-height: 1.5; word-break: break-word; }
        .retry-btn {
            width: 100%; margin-top: 16px; padding: 14px; border: 1px solid rgba(59,130,246,0.3);
            border-radius: var(--radius-md); background: rgba(59,130,246,0.08);
            color: #93c5fd; font-family: 'Inter', sans-serif;
            font-size: 14px; font-weight: 700; cursor: pointer; transition: all var(--transition);
        }
        .retry-btn:hover { background: rgba(59,130,246,0.15); }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 640px) {
            .container { padding: 24px 16px 60px; }
            .stats-grid { grid-template-columns: 1fr; }
            .header-badge { display: none; }
        }
    </style>
</head>
<body>
    <div class="bg-gradient"></div>
    <div class="grid-overlay"></div>
    <div class="container">
        <!-- Nav -->
        <div class="nav">
            <a href="/widget" class="nav-back">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Back to Hub
            </a>
        </div>

        <!-- Header -->
        <div class="header">
            <div class="header-icon">&#x1f4ca;</div>
            <div class="header-text">
                <h1>GST 2B Reconciliation</h1>
                <p>Match GSTR-2B with Purchase Register</p>
            </div>
            <div class="header-badge">v2.0</div>
        </div>

        <!-- Uploads -->
        <div class="section-label">
            <span>Upload Files</span>
            <span class="tag tag-required">Both Required</span>
            <div class="line"></div>
        </div>

        <div class="upload-card" id="card2b">
            <div class="drop-zone" id="zone2b">
                <input type="file" id="file_2b" accept=".xlsx,.xls" onchange="onFile(this,'card2b','fn2b')">
                <div class="drop-icon">&#x1f4c2;</div>
                <div class="drop-label">GSTR-2B Data</div>
                <div class="drop-hint">GST Portal Export &middot; .xlsx</div>
                <div class="drop-filename" id="fn2b"></div>
            </div>
            <div class="card-footer">
                <a href="/gst2b/sample/gstr2b" class="sample-btn" download onclick="event.stopPropagation()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Sample Format
                </a>
            </div>
        </div>

        <div class="upload-card" id="cardPR">
            <div class="drop-zone" id="zonePR">
                <input type="file" id="file_pr" accept=".xlsx,.xls" onchange="onFile(this,'cardPR','fnPR')">
                <div class="drop-icon">&#x1f4cb;</div>
                <div class="drop-label">Purchase Register</div>
                <div class="drop-hint">Books / Tally Export &middot; .xlsx</div>
                <div class="drop-filename" id="fnPR"></div>
            </div>
            <div class="card-footer">
                <a href="/gst2b/sample/purchase" class="sample-btn" download onclick="event.stopPropagation()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Sample Format
                </a>
            </div>
        </div>

        <!-- Run -->
        <div class="run-section">
            <button class="run-btn" id="btnRun" onclick="runReconciliation()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Run Reconciliation
            </button>
        </div>

        <!-- Loading -->
        <div id="loading">
            <div class="progress-card">
                <div class="spinner"></div>
                <div class="loading-title">Reconciling your data...</div>
                <div class="loading-sub">Matching invoices across 2B and Purchase Register</div>
            </div>
        </div>

        <!-- Result -->
        <div id="result"></div>
    </div>

    <script>
        const API_BASE = window.location.origin;

        document.querySelectorAll('.drop-zone').forEach(zone => {
            zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
            zone.addEventListener('drop', e => {
                e.preventDefault(); zone.classList.remove('dragover');
                const input = zone.querySelector('input[type="file"]');
                if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; input.dispatchEvent(new Event('change')); }
            });
        });

        function onFile(inp, cardId, fnId) {
            const f = inp.files[0];
            const fnEl = document.getElementById(fnId);
            fnEl.textContent = f ? f.name : '';
            fnEl.style.display = f ? 'flex' : 'none';
            document.getElementById(cardId).classList.toggle('has-file', !!f);
        }

        function fmt(n) { return Number(n).toLocaleString('en-IN', {maximumFractionDigits: 0}); }
        function fmtAmt(n) { return '\u20B9' + Number(n).toLocaleString('en-IN', {maximumFractionDigits: 0}); }

        async function runReconciliation() {
            const file_2b = document.getElementById('file_2b').files[0];
            const file_pr = document.getElementById('file_pr').files[0];
            if (!file_2b || !file_pr) { alert('Please upload both GSTR-2B and Purchase Register files.'); return; }

            const btn = document.getElementById('btnRun');
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div> Processing...';
            document.getElementById('loading').style.display = 'block';
            document.getElementById('result').style.display = 'none';

            const fd = new FormData();
            fd.append('file_2b', file_2b);
            fd.append('file_pr', file_pr);

            try {
                const res = await fetch(API_BASE + '/gst2b/reconcile', { method: 'POST', body: fd });
                const data = await res.json();
                document.getElementById('loading').style.display = 'none';
                document.getElementById('result').style.display = 'block';
                resetBtn();

                if (data.success) {
                    const s = data.summary;
                    const dlUrl = API_BASE + data.download_url;
                    document.getElementById('result').innerHTML = `
                    <div class="result-header">
                        <div class="result-check">&#x2713;</div>
                        <div>
                            <h2>Reconciliation Complete</h2>
                            <p>All invoices processed successfully</p>
                        </div>
                    </div>
                    <div class="meta-row">
                        <div class="meta-item"><div class="meta-val">${fmt(s.total_2b_records)}</div><div class="meta-lbl">2B Records</div></div>
                        <div class="meta-divider"></div>
                        <div class="meta-item"><div class="meta-val">${fmt(s.total_pr_records)}</div><div class="meta-lbl">Books Records</div></div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-card green">
                            <div class="stat-top"><div class="stat-dot"></div><span class="stat-label">Matched</span></div>
                            <div class="stat-count">${fmt(s.matched_count)}</div>
                            <div class="stat-amount">Taxable ${fmtAmt(s.matched_taxable)}<br>Tax ${fmtAmt(s.matched_tax)}</div>
                        </div>
                        <div class="stat-card amber">
                            <div class="stat-top"><div class="stat-dot"></div><span class="stat-label">Mismatched</span></div>
                            <div class="stat-count">${fmt(s.mismatched_count)}</div>
                            <div class="stat-amount">2B ${fmtAmt(s.mismatched_2b_taxable)}<br>Books ${fmtAmt(s.mismatched_books_taxable)}</div>
                        </div>
                        <div class="stat-card red">
                            <div class="stat-top"><div class="stat-dot"></div><span class="stat-label">Not in 2B</span></div>
                            <div class="stat-count">${fmt(s.not_in_2b_count)}</div>
                            <div class="stat-amount">Taxable ${fmtAmt(s.not_in_2b_taxable)}<br>Tax ${fmtAmt(s.not_in_2b_tax)}</div>
                        </div>
                        <div class="stat-card blue">
                            <div class="stat-top"><div class="stat-dot"></div><span class="stat-label">Not in Books</span></div>
                            <div class="stat-count">${fmt(s.not_in_books_count)}</div>
                            <div class="stat-amount">Taxable ${fmtAmt(s.not_in_books_taxable)}<br>Tax ${fmtAmt(s.not_in_books_tax)}</div>
                        </div>
                    </div>
                    <a href="${dlUrl}" target="_blank" class="dl-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download Reconciliation Report
                    </a>`;
                } else {
                    showError('Reconciliation Failed', data.error || data.detail || 'Unknown error.');
                }
            } catch(e) {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('result').style.display = 'block';
                resetBtn();
                showError('Connection Error', e.message);
            }
        }

        function showError(title, msg) {
            document.getElementById('result').innerHTML = `
            <div class="err-card">
                <div class="err-icon">&#x26a0;&#xfe0f;</div>
                <div><div class="err-title">${title}</div><div class="err-msg">${msg}</div></div>
            </div>
            <button class="retry-btn" onclick="location.reload()">&#x21ba; Try Again</button>`;
        }

        function resetBtn() {
            const btn = document.getElementById('btnRun');
            btn.disabled = false;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Run Reconciliation';
        }
    </script>
</body>
</html>'''
