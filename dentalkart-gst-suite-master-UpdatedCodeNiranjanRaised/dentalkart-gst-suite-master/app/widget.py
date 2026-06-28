"""HTML widget template for the web UI - Professional Design."""

WIDGET_HTML = r'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ComplianceGuard - Invoice Compliance Analyzer</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0a0e1a;
            --bg-secondary: #111827;
            --bg-card: rgba(17, 24, 39, 0.7);
            --bg-card-hover: rgba(30, 41, 59, 0.8);
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
            --danger-glow: rgba(239,68,68,0.1);
            --radius-sm: 8px;
            --radius-md: 12px;
            --radius-lg: 16px;
            --radius-xl: 20px;
            --shadow-card: 0 4px 24px rgba(0,0,0,0.25);
            --shadow-glow: 0 0 40px rgba(99,102,241,0.08);
            --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            overflow-x: hidden;
            -webkit-font-smoothing: antialiased;
        }

        /* === AMBIENT BACKGROUND === */
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

        /* === LAYOUT === */
        .container {
            position: relative; z-index: 1;
            max-width: 960px;
            margin: 0 auto;
            padding: 40px 24px 80px;
        }

        /* === HEADER === */
        .header {
            display: flex; align-items: center; gap: 16px;
            margin-bottom: 40px;
            animation: fadeDown 0.6s ease-out;
        }
        .header-icon {
            width: 52px; height: 52px; border-radius: var(--radius-md);
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            display: flex; align-items: center; justify-content: center;
            font-size: 24px;
            box-shadow: 0 8px 24px rgba(99,102,241,0.3);
            flex-shrink: 0;
        }
        .header-text h1 {
            font-size: 22px; font-weight: 800; letter-spacing: -0.5px;
            background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .header-text p {
            font-size: 13px; color: var(--text-muted); font-weight: 500;
            margin-top: 2px; letter-spacing: 0.02em;
        }
        .header-badge {
            margin-left: auto;
            padding: 5px 14px; border-radius: 20px;
            background: var(--accent-glow);
            border: 1px solid rgba(99,102,241,0.2);
            font-size: 11px; font-weight: 700; color: var(--accent-light);
            letter-spacing: 0.06em; text-transform: uppercase;
        }

        /* === SECTION LABELS === */
        .section-label {
            display: flex; align-items: center; gap: 10px;
            margin: 32px 0 16px;
            animation: fadeDown 0.6s ease-out;
        }
        .section-label span {
            font-size: 11px; font-weight: 700; color: var(--text-muted);
            text-transform: uppercase; letter-spacing: 0.1em;
        }
        .section-label .line {
            flex: 1; height: 1px;
            background: linear-gradient(90deg, var(--border), transparent);
        }
        .tag { padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; }
        .tag-required { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
        .tag-optional { background: rgba(100,116,139,0.12); color: #94a3b8; border: 1px solid rgba(100,116,139,0.2); }

        /* === UPLOAD GRID === */
        .upload-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        .upload-grid.single { grid-template-columns: 1fr; max-width: calc(50% - 8px); }

        /* === UPLOAD CARD === */
        .upload-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            backdrop-filter: blur(12px);
            transition: all var(--transition);
            overflow: hidden;
            animation: fadeUp 0.5s ease-out both;
        }
        .upload-card:nth-child(1) { animation-delay: 0.05s; }
        .upload-card:nth-child(2) { animation-delay: 0.1s; }
        .upload-card:hover {
            border-color: var(--border-hover);
            box-shadow: var(--shadow-glow);
            transform: translateY(-2px);
        }
        .upload-card.has-file {
            border-color: rgba(16,185,129,0.35);
            background: rgba(16,185,129,0.04);
        }
        .upload-card.has-file:hover {
            box-shadow: 0 0 30px rgba(16,185,129,0.08);
        }

        .drop-zone {
            position: relative;
            padding: 28px 20px 22px;
            text-align: center;
            cursor: pointer;
            transition: all var(--transition);
        }
        .drop-zone.dragover {
            background: var(--accent-glow);
        }
        .drop-zone input[type="file"] {
            position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
        }
        .drop-icon {
            width: 48px; height: 48px;
            border-radius: var(--radius-md);
            background: var(--bg-glass);
            border: 1px solid var(--border);
            display: flex; align-items: center; justify-content: center;
            font-size: 22px;
            margin: 0 auto 12px;
            transition: all var(--transition);
        }
        .upload-card:hover .drop-icon {
            border-color: var(--border-hover);
            background: var(--accent-glow);
        }
        .upload-card.has-file .drop-icon {
            border-color: rgba(16,185,129,0.3);
            background: var(--success-glow);
        }
        .drop-label {
            font-size: 14px; font-weight: 700; color: var(--text-primary);
            margin-bottom: 4px;
        }
        .drop-hint {
            font-size: 11px; color: var(--text-muted); font-weight: 400;
        }
        .drop-filename {
            font-size: 11px; color: var(--success); font-weight: 600;
            margin-top: 8px; word-break: break-all;
            display: flex; align-items: center; justify-content: center; gap: 5px;
        }
        .drop-filename::before { content: '\2713'; font-size: 13px; }

        .card-footer {
            display: flex; border-top: 1px solid var(--border); padding: 0;
        }
        .sample-btn {
            flex: 1;
            display: flex; align-items: center; justify-content: center; gap: 6px;
            padding: 10px;
            font-size: 11px; font-weight: 600; color: var(--text-muted);
            text-decoration: none;
            transition: all var(--transition);
            background: transparent;
        }
        .sample-btn:hover {
            color: var(--accent-light);
            background: var(--accent-glow);
        }

        /* === RUN BUTTON === */
        .run-section {
            margin-top: 32px;
            animation: fadeUp 0.5s ease-out 0.3s both;
        }
        .run-btn {
            width: 100%; padding: 18px 24px;
            border: none; border-radius: var(--radius-lg);
            font-family: 'Inter', sans-serif;
            font-size: 15px; font-weight: 700; letter-spacing: 0.02em;
            color: #fff; cursor: pointer;
            background: linear-gradient(135deg, #6366f1, #7c3aed, #6366f1);
            background-size: 200% 200%;
            box-shadow: 0 8px 32px rgba(99,102,241,0.35);
            transition: all var(--transition);
            display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .run-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(99,102,241,0.5);
            background-position: 100% 0;
        }
        .run-btn:active:not(:disabled) { transform: translateY(0); }
        .run-btn:disabled {
            opacity: 0.5; cursor: not-allowed;
            box-shadow: none; transform: none;
        }
        .run-btn svg { width: 18px; height: 18px; }

        /* === PROGRESS === */
        #loading { display: none; margin-top: 28px; animation: fadeUp 0.4s ease-out; }
        .progress-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 28px 24px;
            backdrop-filter: blur(12px);
        }
        .progress-top {
            display: flex; align-items: center; gap: 16px;
            margin-bottom: 20px;
        }
        .spinner {
            width: 40px; height: 40px; border-radius: 50%;
            border: 3px solid rgba(99,102,241,0.15);
            border-top-color: var(--accent);
            animation: spin 0.8s linear infinite;
            flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .progress-info h3 { font-size: 14px; font-weight: 600; color: var(--text-primary); }
        .progress-info p { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
        .progress-track {
            width: 100%; height: 6px;
            background: rgba(99,102,241,0.1);
            border-radius: 99px; overflow: hidden;
        }
        .progress-fill {
            height: 100%; border-radius: 99px;
            background: linear-gradient(90deg, #6366f1, #8b5cf6);
            transition: width 0.5s ease;
            position: relative;
        }
        .progress-fill::after {
            content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 40px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2));
            border-radius: 99px;
        }
        .progress-pct {
            text-align: right; margin-top: 8px;
            font-size: 12px; font-weight: 700; color: var(--accent-light);
            font-variant-numeric: tabular-nums;
        }

        /* === RESULT === */
        #result { display: none; margin-top: 28px; animation: fadeUp 0.5s ease-out; }

        .result-header {
            display: flex; align-items: center; gap: 14px;
            margin-bottom: 24px;
        }
        .result-check {
            width: 44px; height: 44px; border-radius: 50%;
            background: linear-gradient(135deg, #10b981, #059669);
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; color: #fff;
            box-shadow: 0 6px 20px rgba(16,185,129,0.3);
            flex-shrink: 0;
        }
        .result-header h2 { font-size: 18px; font-weight: 800; color: #d1fae5; }
        .result-header p { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

        /* Stats Cards */
        .stats-row {
            display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
            margin-bottom: 24px;
        }
        .stat-card {
            background: var(--bg-glass);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: 16px 18px;
        }
        .stat-value {
            font-size: 26px; font-weight: 900; letter-spacing: -1px;
            background: linear-gradient(135deg, #c7d2fe, #e0e7ff);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            font-variant-numeric: tabular-nums;
        }
        .stat-label {
            font-size: 11px; font-weight: 600; color: var(--text-muted);
            text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px;
        }

        /* Annexure List */
        .anx-section-title {
            font-size: 11px; font-weight: 700; color: var(--text-muted);
            text-transform: uppercase; letter-spacing: 0.1em;
            margin-bottom: 12px;
        }
        .anx-list {
            display: flex; flex-direction: column; gap: 6px;
            margin-bottom: 28px;
            max-height: 520px; overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(99,102,241,0.2) transparent;
        }
        .anx-list::-webkit-scrollbar { width: 4px; }
        .anx-list::-webkit-scrollbar-track { background: transparent; }
        .anx-list::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius: 4px; }

        .anx-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 16px;
            border-radius: var(--radius-sm);
            border: 1px solid transparent;
            transition: all var(--transition);
        }
        .anx-item:hover { background: var(--bg-glass); }
        .anx-item.ok { background: rgba(16,185,129,0.04); border-color: rgba(16,185,129,0.1); }
        .anx-item.warn { background: rgba(245,158,11,0.04); border-color: rgba(245,158,11,0.1); }
        .anx-item.danger { background: rgba(239,68,68,0.05); border-color: rgba(239,68,68,0.12); }
        .anx-left { display: flex; align-items: center; gap: 12px; }
        .anx-dot {
            width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .ok .anx-dot { background: var(--success); box-shadow: 0 0 8px rgba(16,185,129,0.4); }
        .warn .anx-dot { background: var(--warning); box-shadow: 0 0 8px rgba(245,158,11,0.3); }
        .danger .anx-dot { background: var(--danger); box-shadow: 0 0 8px rgba(239,68,68,0.3); }
        .anx-name { font-size: 12px; font-weight: 700; color: var(--text-primary); }
        .anx-desc { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
        .anx-count {
            font-size: 18px; font-weight: 900; font-variant-numeric: tabular-nums;
            min-width: 40px; text-align: right;
        }
        .ok .anx-count { color: var(--success); }
        .warn .anx-count { color: var(--warning); }
        .danger .anx-count { color: var(--danger); }

        /* Download Button */
        .dl-btn {
            width: 100%; padding: 16px 24px;
            border: none; border-radius: var(--radius-lg);
            font-family: 'Inter', sans-serif;
            font-size: 15px; font-weight: 700;
            color: #fff; cursor: pointer;
            background: linear-gradient(135deg, #10b981, #059669);
            box-shadow: 0 8px 28px rgba(16,185,129,0.3);
            display: flex; align-items: center; justify-content: center; gap: 10px;
            text-decoration: none;
            transition: all var(--transition);
        }
        .dl-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 36px rgba(16,185,129,0.4);
        }
        .dl-btn svg { width: 18px; height: 18px; }

        /* Error */
        .err-card {
            background: var(--danger-glow);
            border: 1px solid rgba(239,68,68,0.2);
            border-radius: var(--radius-lg);
            padding: 24px;
            display: flex; gap: 16px; align-items: flex-start;
        }
        .err-icon { font-size: 28px; flex-shrink: 0; line-height: 1; }
        .err-title { font-size: 14px; font-weight: 700; color: #fca5a5; margin-bottom: 6px; }
        .err-msg { font-size: 13px; color: #f87171; line-height: 1.5; word-break: break-word; }
        .retry-btn {
            width: 100%; margin-top: 16px; padding: 14px;
            border: 1px solid rgba(99,102,241,0.3); border-radius: var(--radius-md);
            background: var(--accent-glow);
            color: var(--accent-light); font-family: 'Inter', sans-serif;
            font-size: 14px; font-weight: 700; cursor: pointer;
            transition: all var(--transition);
        }
        .retry-btn:hover { background: rgba(99,102,241,0.15); }

        /* Animations */
        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeDown {
            from { opacity: 0; transform: translateY(-12px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Responsive */
        @media (max-width: 640px) {
            .container { padding: 24px 16px 60px; }
            .upload-grid { grid-template-columns: 1fr; }
            .upload-grid.single { max-width: 100%; }
            .stats-row { grid-template-columns: 1fr; }
            .header-badge { display: none; }
        }
    </style>
</head>
<body>
    <div class="bg-gradient"></div>
    <div class="grid-overlay"></div>

    <div class="container">
        <!-- NAV -->
        <div style="margin-bottom:12px;animation:fadeDown 0.5s ease-out;">
            <a href="/widget" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:#64748b;font-size:12px;font-weight:600;text-decoration:none;transition:all 0.25s;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Back to Hub
            </a>
        </div>

        <!-- HEADER -->
        <div class="header">
            <div class="header-icon">&#x1f6e1;&#xfe0f;</div>
            <div class="header-text">
                <h1>ComplianceGuard</h1>
                <p>Invoice Compliance Analyzer</p>
            </div>
            <div class="header-badge">v3.0</div>
        </div>

        <!-- REQUIRED FILES -->
        <div class="section-label">
            <span>Required Files</span>
            <span class="tag tag-required">Required</span>
            <div class="line"></div>
        </div>
        <div class="upload-grid">
            <div class="upload-card" id="card1">
                <div class="drop-zone" id="zone1">
                    <input type="file" id="sales_file" accept=".xlsx,.xls,.xlsb" onchange="onFile(this,'card1','fn1')">
                    <div class="drop-icon">&#x1f4ca;</div>
                    <div class="drop-label">Sales Data</div>
                    <div class="drop-hint">Vinculum Export &middot; .xlsx / .xlsb</div>
                    <div class="drop-filename" id="fn1"></div>
                </div>
                <div class="card-footer">
                    <a href="/sample/sales" class="sample-btn" download onclick="event.stopPropagation()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Sample Format
                    </a>
                </div>
            </div>
            <div class="upload-card" id="card2">
                <div class="drop-zone" id="zone2">
                    <input type="file" id="einvoice_file" accept=".xlsx,.xls" onchange="onFile(this,'card2','fn2')">
                    <div class="drop-icon">&#x1f9fe;</div>
                    <div class="drop-label">E-Invoice</div>
                    <div class="drop-hint">GST Portal Export &middot; .xlsx</div>
                    <div class="drop-filename" id="fn2"></div>
                </div>
                <div class="card-footer">
                    <a href="/sample/einvoice" class="sample-btn" download onclick="event.stopPropagation()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Sample Format
                    </a>
                </div>
            </div>
        </div>

        <!-- OPTIONAL FILES -->
        <div class="section-label">
            <span>Optional Files</span>
            <span class="tag tag-optional">Optional</span>
            <div class="line"></div>
        </div>
        <div class="upload-grid">
            <div class="upload-card" id="card3">
                <div class="drop-zone" id="zone3">
                    <input type="file" id="ewaybill_file" accept=".xlsx,.xls" onchange="onFile(this,'card3','fn3')">
                    <div class="drop-icon">&#x1f69a;</div>
                    <div class="drop-label">E-way Bill</div>
                    <div class="drop-hint">Outward + Inward Supply</div>
                    <div class="drop-filename" id="fn3"></div>
                </div>
                <div class="card-footer">
                    <a href="/sample/ewaybill" class="sample-btn" download onclick="event.stopPropagation()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Sample Format
                    </a>
                </div>
            </div>
            <div class="upload-card" id="card4">
                <div class="drop-zone" id="zone4">
                    <input type="file" id="creditnote_file" accept=".xlsx,.xls,.xlsb" onchange="onFile(this,'card4','fn4')">
                    <div class="drop-icon">&#x1f4dd;</div>
                    <div class="drop-label">Credit Note</div>
                    <div class="drop-hint">Returns Data &middot; .xlsx / .xlsb</div>
                    <div class="drop-filename" id="fn4"></div>
                </div>
                <div class="card-footer">
                    <a href="/sample/creditnote" class="sample-btn" download onclick="event.stopPropagation()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Sample Format
                    </a>
                </div>
            </div>
        </div>

        <!-- CDNR -->
        <div class="section-label">
            <span>CN E-Invoice (CDNR)</span>
            <span class="tag tag-optional">Optional</span>
            <div class="line"></div>
        </div>
        <div class="upload-grid single">
            <div class="upload-card" id="card5">
                <div class="drop-zone" id="zone5">
                    <input type="file" id="cn_einvoice_file" accept=".xlsx,.xls" onchange="onFile(this,'card5','fn5')">
                    <div class="drop-icon">&#x1f4c4;</div>
                    <div class="drop-label">CN E-Invoice</div>
                    <div class="drop-hint">GST Portal CDNR Export</div>
                    <div class="drop-filename" id="fn5"></div>
                </div>
                <div class="card-footer">
                    <a href="/sample/cn-einvoice" class="sample-btn" download onclick="event.stopPropagation()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Sample Format
                    </a>
                </div>
            </div>
        </div>

        <!-- RUN -->
        <div class="run-section">
            <button class="run-btn" id="btnRun" onclick="runAnalysis()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Run Compliance Check
            </button>
        </div>

        <!-- PROGRESS -->
        <div id="loading">
            <div class="progress-card">
                <div class="progress-top">
                    <div class="spinner"></div>
                    <div class="progress-info">
                        <h3 id="prog-label">Uploading files...</h3>
                        <p id="prog-sub">This may take 30-60 seconds for large files</p>
                    </div>
                </div>
                <div class="progress-track"><div class="progress-fill" id="prog-bar" style="width:0%"></div></div>
                <div class="progress-pct" id="prog-pct">0%</div>
            </div>
        </div>

        <!-- RESULT -->
        <div id="result"></div>
    </div>

    <script>
        const API_BASE = window.location.origin;
        const ANX_META = {
            annexure_1_count:  { name:'Annexure 1',  desc:'E-Invoice vs Sales Amount Mismatch',     danger:false },
            annexure_2_count:  { name:'Annexure 2',  desc:'B2B Invoices Missing in E-Invoice',      danger:true  },
            annexure_3_count:  { name:'Annexure 3',  desc:'E-Invoices Missing in Sales Data',       danger:false },
            annexure_4_count:  { name:'Annexure 4',  desc:'Sales >= 50K Missing E-way Bill',        danger:true  },
            annexure_5_count:  { name:'Annexure 5',  desc:'E-Invoice >= 50K No E-way Bill',         danger:false },
            annexure_6_count:  { name:'Annexure 6',  desc:'E-way Bills Missing in Sales',           danger:false },
            annexure_7_count:  { name:'Annexure 7',  desc:'E-way Bills (GST) Not in E-Invoice',    danger:false },
            annexure_8_count:  { name:'Annexure 8',  desc:'TES SKU with E-Invoice/E-way Bill',     danger:true  },
            annexure_9_count:  { name:'Annexure 9',  desc:'Administration Order Channel',           danger:false },
            annexure_10_count: { name:'Annexure 10', desc:'High Discount (>= 90%)',                 danger:true  },
            annexure_11_count: { name:'Annexure 11', desc:'Zero OrderAmount Invoices',              danger:false },
            annexure_12_count: { name:'Annexure 12', desc:'CDNR Missing in Credit Note',            danger:true  },
            annexure_13_count: { name:'Annexure 13', desc:'Credit Notes Missing in CDNR',           danger:true  },
            annexure_14_count: { name:'Annexure 14', desc:'CN >= 50K Missing E-way Inward',         danger:false },
            annexure_15_count: { name:'Annexure 15', desc:'CDNR >= 50K Missing E-way Inward',       danger:false },
            annexure_16_count: { name:'Annexure 16', desc:'E-way Inward Missing in CN',             danger:false },
            annexure_17_count: { name:'Annexure 17', desc:'CDNR vs Credit Note Value Mismatch',     danger:true  },
        };

        /* --- Drag & drop for all zones --- */
        document.querySelectorAll('.drop-zone').forEach(zone => {
            zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
            zone.addEventListener('drop', e => {
                e.preventDefault(); zone.classList.remove('dragover');
                const input = zone.querySelector('input[type="file"]');
                if (e.dataTransfer.files.length) {
                    input.files = e.dataTransfer.files;
                    input.dispatchEvent(new Event('change'));
                }
            });
        });

        function onFile(inp, cardId, fnId) {
            const f = inp.files[0];
            const fnEl = document.getElementById(fnId);
            fnEl.textContent = f ? f.name : '';
            fnEl.style.display = f ? 'flex' : 'none';
            document.getElementById(cardId).classList.toggle('has-file', !!f);
        }

        function fmt(n) { return Number(n).toLocaleString('en-IN'); }

        function setProgress(pct, label, sub) {
            document.getElementById('prog-bar').style.width = pct + '%';
            document.getElementById('prog-pct').textContent = pct + '%';
            if (label) document.getElementById('prog-label').textContent = label;
            if (sub !== undefined) document.getElementById('prog-sub').textContent = sub;
        }

        async function runAnalysis() {
            const sales     = document.getElementById('sales_file').files[0];
            const einvoice  = document.getElementById('einvoice_file').files[0];
            const ewaybill  = document.getElementById('ewaybill_file').files[0];
            const creditnote= document.getElementById('creditnote_file').files[0];
            if (!sales || !einvoice) {
                alert('Please upload both Sales Data and E-Invoice files.');
                return;
            }
            document.getElementById('btnRun').disabled = true;
            document.getElementById('btnRun').innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div> Uploading...';
            document.getElementById('loading').style.display = 'block';
            document.getElementById('result').style.display = 'none';
            setProgress(3, 'Uploading files...', 'Sales file: ' + (sales.size/1024/1024).toFixed(1) + ' MB');

            const fd = new FormData();
            fd.append('sales_file', sales);
            fd.append('einvoice_file', einvoice);
            if (ewaybill)    fd.append('ewaybill_file', ewaybill);
            if (creditnote)  fd.append('creditnote_file', creditnote);
            const cn_einvoice = document.getElementById('cn_einvoice_file').files[0];
            if (cn_einvoice) fd.append('cn_einvoice_file', cn_einvoice);

            let jobId;
            try {
                const res  = await fetch(API_BASE + '/analyze', { method:'POST', body:fd });
                const data = await res.json();
                if (!data.job_id) throw new Error(data.error || 'Failed to start job');
                jobId = data.job_id;
                setProgress(10, 'Job submitted \u2014 processing...', '');
                document.getElementById('btnRun').innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div> Processing...';
            } catch(e) {
                showError('Upload Failed', e.message);
                return;
            }

            const poll = setInterval(async () => {
                try {
                    const r = await fetch(API_BASE + '/status/' + jobId);
                    const d = await r.json();
                    setProgress(Math.max(d.pct || 10, 10), d.msg || 'Processing...', '');
                    if (d.status === 'done') {
                        clearInterval(poll);
                        showResult(d.result);
                    } else if (d.status === 'error') {
                        clearInterval(poll);
                        showError('Processing Failed', d.result?.error || 'Unknown error');
                    }
                } catch(e) { }
            }, 1500);
        }

        function showResult(data) {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('result').style.display = 'block';
            resetBtn();
            const s = data.summary;
            const downloadUrl = API_BASE + '/download/' + data.filename;
            const totalIssues = Object.keys(ANX_META).reduce((a,k) => a + (s[k]||0), 0);

            let annRows = '';
            for (const [key, meta] of Object.entries(ANX_META)) {
                const cnt = s[key] || 0;
                const cls = cnt === 0 ? 'ok' : (meta.danger ? 'danger' : 'warn');
                annRows += `
                <div class="anx-item ${cls}">
                    <div class="anx-left">
                        <div class="anx-dot"></div>
                        <div>
                            <div class="anx-name">${meta.name}</div>
                            <div class="anx-desc">${meta.desc}</div>
                        </div>
                    </div>
                    <div class="anx-count">${fmt(cnt)}</div>
                </div>`;
            }

            document.getElementById('result').innerHTML = `
            <div class="result-header">
                <div class="result-check">&#x2713;</div>
                <div>
                    <h2>Analysis Complete</h2>
                    <p>${fmt(totalIssues)} total issues found across 17 annexures</p>
                </div>
            </div>
            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-value">${fmt(s.total_sales_records)}</div>
                    <div class="stat-label">B2B Sales Invoices</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${fmt(s.total_einvoice_records)}</div>
                    <div class="stat-label">E-Invoice Records</div>
                </div>
            </div>
            <div class="anx-section-title">Annexure Results</div>
            <div class="anx-list">${annRows}</div>
            <a href="${downloadUrl}" target="_blank" class="dl-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download Compliance Report
            </a>`;
        }

        function showError(title, msg) {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('result').style.display = 'block';
            resetBtn();
            document.getElementById('result').innerHTML = `
            <div class="err-card">
                <div class="err-icon">&#x26a0;&#xfe0f;</div>
                <div>
                    <div class="err-title">${title}</div>
                    <div class="err-msg">${msg}</div>
                </div>
            </div>
            <button class="retry-btn" onclick="location.reload()">&#x21ba; Try Again</button>`;
        }

        function resetBtn() {
            const btn = document.getElementById('btnRun');
            btn.disabled = false;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Run Compliance Check';
        }

        // Hide empty filenames on load
        document.querySelectorAll('.drop-filename').forEach(el => el.style.display = 'none');
    </script>
</body>
</html>'''
