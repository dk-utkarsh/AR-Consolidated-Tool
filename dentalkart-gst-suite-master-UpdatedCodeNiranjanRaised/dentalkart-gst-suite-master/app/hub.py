"""Hub landing page - tool selector."""

HUB_HTML = r'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GST Compliance Suite</title>
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
            --text-muted: #64748b;
            --accent: #6366f1;
            --accent-light: #818cf8;
            --radius-lg: 16px;
            --radius-xl: 20px;
            --transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: var(--bg-primary); color: var(--text-primary);
            min-height: 100vh; -webkit-font-smoothing: antialiased;
            display: flex; align-items: center; justify-content: center;
        }
        .bg-gradient {
            position: fixed; inset: 0; pointer-events: none;
            background:
                radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.1) 0%, transparent 60%),
                radial-gradient(ellipse 60% 50% at 50% 100%, rgba(16,185,129,0.06) 0%, transparent 50%);
        }
        .grid-overlay {
            position: fixed; inset: 0; pointer-events: none; opacity: 0.03;
            background-image:
                linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
            background-size: 60px 60px;
        }
        .container {
            position: relative; z-index: 1; text-align: center;
            padding: 40px 24px; width: 100%; max-width: 760px;
        }

        /* Header */
        .logo {
            width: 72px; height: 72px; border-radius: 20px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            display: flex; align-items: center; justify-content: center;
            font-size: 32px; margin: 0 auto 20px;
            box-shadow: 0 12px 40px rgba(99,102,241,0.35);
            animation: fadeDown 0.6s ease-out;
        }
        h1 {
            font-size: 32px; font-weight: 900; letter-spacing: -1px;
            background: linear-gradient(135deg, #e0e7ff, #c7d2fe, #a5b4fc);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            margin-bottom: 8px;
            animation: fadeDown 0.6s ease-out 0.05s both;
        }
        .subtitle {
            font-size: 15px; color: var(--text-muted); font-weight: 400;
            margin-bottom: 48px;
            animation: fadeDown 0.6s ease-out 0.1s both;
        }

        /* Tool Cards */
        .tools-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
        }
        .tool-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius-xl);
            padding: 36px 28px 32px;
            text-decoration: none; color: var(--text-primary);
            backdrop-filter: blur(12px);
            transition: all var(--transition);
            position: relative; overflow: hidden;
            animation: fadeUp 0.5s ease-out both;
        }
        .tool-card:nth-child(1) { animation-delay: 0.15s; }
        .tool-card:nth-child(2) { animation-delay: 0.25s; }
        .tool-card::before {
            content: ''; position: absolute; inset: 0;
            background: linear-gradient(135deg, transparent, rgba(99,102,241,0.03));
            opacity: 0; transition: opacity var(--transition);
        }
        .tool-card:hover::before { opacity: 1; }
        .tool-card:hover {
            border-color: var(--border-hover);
            transform: translateY(-4px);
            box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 40px rgba(99,102,241,0.08);
        }
        .tool-card.purple:hover { box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 40px rgba(99,102,241,0.12); }
        .tool-card.blue:hover   { box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 40px rgba(59,130,246,0.12); }

        .tool-icon {
            width: 56px; height: 56px; border-radius: 16px;
            display: flex; align-items: center; justify-content: center;
            font-size: 26px; margin: 0 auto 18px;
            transition: all var(--transition);
        }
        .purple .tool-icon {
            background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1));
            border: 1px solid rgba(99,102,241,0.2);
        }
        .blue .tool-icon {
            background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.1));
            border: 1px solid rgba(59,130,246,0.2);
        }
        .tool-card:hover .tool-icon { transform: scale(1.08); }

        .tool-title {
            font-size: 17px; font-weight: 800; margin-bottom: 8px;
            letter-spacing: -0.3px;
        }
        .purple .tool-title { color: #c7d2fe; }
        .blue .tool-title   { color: #bfdbfe; }

        .tool-desc {
            font-size: 13px; color: var(--text-muted); line-height: 1.6;
            margin-bottom: 20px;
        }
        .tool-tags {
            display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;
        }
        .tool-tag {
            padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 600;
            letter-spacing: 0.04em; text-transform: uppercase;
        }
        .purple .tool-tag { background: rgba(99,102,241,0.1); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.15); }
        .blue .tool-tag   { background: rgba(59,130,246,0.1); color: #93c5fd; border: 1px solid rgba(59,130,246,0.15); }

        .tool-arrow {
            position: absolute; top: 20px; right: 20px;
            width: 28px; height: 28px; border-radius: 8px;
            background: var(--bg-glass); border: 1px solid var(--border);
            display: flex; align-items: center; justify-content: center;
            transition: all var(--transition);
        }
        .tool-card:hover .tool-arrow {
            background: var(--accent); border-color: var(--accent);
        }
        .tool-arrow svg { width: 14px; height: 14px; color: var(--text-muted); transition: color var(--transition); }
        .tool-card:hover .tool-arrow svg { color: #fff; }

        /* Footer */
        .footer {
            margin-top: 48px; font-size: 12px; color: rgba(100,116,139,0.5);
            animation: fadeUp 0.5s ease-out 0.35s both;
        }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 640px) {
            .tools-grid { grid-template-columns: 1fr; }
            h1 { font-size: 26px; }
        }
    </style>
</head>
<body>
    <div class="bg-gradient"></div>
    <div class="grid-overlay"></div>
    <div class="container">
        <div class="logo">&#x1f6e1;&#xfe0f;</div>
        <h1>GST Compliance Suite</h1>
        <p class="subtitle">Select a tool to get started</p>

        <div class="tools-grid">
            <a href="/compliance/widget" class="tool-card purple">
                <div class="tool-arrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
                <div class="tool-icon">&#x1f6e1;&#xfe0f;</div>
                <div class="tool-title">ComplianceGuard</div>
                <div class="tool-desc">Invoice compliance analyzer with 17 annexures across Sales, E-Invoice, E-way Bill &amp; Credit Notes</div>
                <div class="tool-tags">
                    <span class="tool-tag">17 Annexures</span>
                    <span class="tool-tag">E-Invoice</span>
                    <span class="tool-tag">E-way Bill</span>
                </div>
            </a>

            <a href="/gst2b/widget" class="tool-card blue">
                <div class="tool-arrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
                <div class="tool-icon">&#x1f4ca;</div>
                <div class="tool-title">GST 2B Reconciliation</div>
                <div class="tool-desc">Match GSTR-2B data with Purchase Register to find matched, mismatched &amp; missing invoices</div>
                <div class="tool-tags">
                    <span class="tool-tag">GSTR-2B</span>
                    <span class="tool-tag">Purchase Register</span>
                    <span class="tool-tag">Matching</span>
                </div>
            </a>
        </div>

        <div class="footer">GST Compliance Suite v3.0</div>
    </div>
</body>
</html>'''
