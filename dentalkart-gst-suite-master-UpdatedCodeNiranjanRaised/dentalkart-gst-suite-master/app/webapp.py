"""Single-page web application - all tools in one professional interface."""

WEBAPP_HTML = r'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dentalkart - GST Compliance Suite</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --sidebar-w: 258px;
            --bg-body: #f0f2f5;
            --bg-sidebar: #1e293b;
            --bg-sidebar-hover: rgba(255,255,255,0.06);
            --bg-sidebar-active: rgba(99,102,241,0.15);
            --bg-main: #f5f7fa;
            --bg-card: #ffffff;
            --bg-card-hover: #f8fafc;
            --bg-glass: #f8f9fb;
            --bg-input: #f1f5f9;
            --border: #e2e8f0;
            --border-hover: #6366f1;
            --border-light: #f1f5f9;
            --text: #1e293b;
            --text-secondary: #475569;
            --text-muted: #94a3b8;
            --text-dim: #cbd5e1;
            --accent: #6366f1;
            --accent-light: #818cf8;
            --accent-bg: rgba(99,102,241,0.06);
            --success: #10b981;
            --success-bg: rgba(16,185,129,0.08);
            --warning: #f59e0b;
            --warning-bg: rgba(245,158,11,0.08);
            --danger: #ef4444;
            --danger-bg: rgba(239,68,68,0.06);
            --info: #3b82f6;
            --info-bg: rgba(59,130,246,0.06);
            --radius: 12px;
            --radius-lg: 16px;
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
            --shadow: 0 4px 16px rgba(0,0,0,0.06);
            --shadow-lg: 0 8px 32px rgba(0,0,0,0.08);
            --ease: cubic-bezier(0.4,0,0.2,1);
        }
        *{margin:0;padding:0;box-sizing:border-box;}
        html{height:100%;}
        body{
            font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
            background:var(--bg-body);color:var(--text);
            height:100%;overflow:hidden;-webkit-font-smoothing:antialiased;
            display:flex;
        }

        /* ========== SIDEBAR ========== */
        .sidebar{
            width:var(--sidebar-w);min-width:var(--sidebar-w);height:100vh;
            background:var(--bg-sidebar);
            display:flex;flex-direction:column;
            overflow-y:auto;position:relative;z-index:10;
        }
        .sidebar-brand{padding:22px 20px 18px;border-bottom:1px solid rgba(255,255,255,0.08);}
        .sidebar-brand-row{display:flex;align-items:center;gap:12px;cursor:default;user-select:none;}
        .brand-icon{
            width:38px;height:38px;border-radius:10px;
            background:linear-gradient(135deg,#6366f1,#8b5cf6);
            display:flex;align-items:center;justify-content:center;
            font-size:17px;flex-shrink:0;
            box-shadow:0 4px 14px rgba(99,102,241,0.35);
        }
        .brand-name{font-size:14px;font-weight:800;color:#f1f5f9;letter-spacing:-0.2px;}
        .brand-sub{font-size:9px;color:rgba(148,163,184,0.7);font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-top:1px;}

        .sidebar-section{padding:14px 12px 4px;}
        .sidebar-section-label{
            font-size:9px;font-weight:700;color:rgba(148,163,184,0.5);
            text-transform:uppercase;letter-spacing:0.12em;
            padding:0 8px;margin-bottom:5px;
        }
        .nav-item{
            display:flex;align-items:center;gap:10px;
            padding:9px 12px;margin:1px 0;border-radius:9px;
            cursor:pointer;font-size:13px;font-weight:500;
            color:rgba(203,213,225,0.8);
            transition:all 0.2s var(--ease);border:1px solid transparent;
            text-decoration:none;
        }
        .nav-item:hover{background:var(--bg-sidebar-hover);color:#e2e8f0;}
        .nav-item.active{
            background:var(--bg-sidebar-active);
            color:#a5b4fc;font-weight:600;
            border-color:rgba(99,102,241,0.12);
        }
        .nav-icon{
            width:30px;height:30px;border-radius:7px;
            display:flex;align-items:center;justify-content:center;
            font-size:14px;flex-shrink:0;
            background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.06);
            transition:all 0.2s var(--ease);
        }
        .nav-item.active .nav-icon{background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.2);}
        .nav-label{flex:1;}
        .nav-badge{
            font-size:9px;font-weight:700;padding:2px 7px;border-radius:5px;
            background:rgba(99,102,241,0.18);color:#a5b4fc;
        }
        .sidebar-footer{margin-top:auto;padding:14px 20px;border-top:1px solid rgba(255,255,255,0.06);}
        .sidebar-footer p{font-size:10px;color:rgba(100,116,139,0.5);}

        /* ========== MAIN ========== */
        .main{flex:1;height:100vh;overflow-y:auto;background:var(--bg-main);position:relative;}
        .main-content{
            position:relative;z-index:1;
            max-width:860px;margin:0 auto;
            padding:32px 28px 80px;
        }

        /* ========== PAGE HEADER ========== */
        .page-header{display:flex;align-items:center;gap:14px;margin-bottom:28px;}
        .page-icon{
            width:44px;height:44px;border-radius:12px;
            display:flex;align-items:center;justify-content:center;
            font-size:20px;flex-shrink:0;color:#fff;
        }
        .page-icon.purple{background:linear-gradient(135deg,#6366f1,#8b5cf6);box-shadow:0 4px 16px rgba(99,102,241,0.25);}
        .page-icon.blue{background:linear-gradient(135deg,#3b82f6,#6366f1);box-shadow:0 4px 16px rgba(59,130,246,0.25);}
        .page-title{font-size:19px;font-weight:800;color:var(--text);letter-spacing:-0.4px;}
        .page-subtitle{font-size:12px;color:var(--text-muted);margin-top:1px;}

        /* ========== VIEWS ========== */
        .view{display:none;animation:viewIn 0.3s var(--ease);}
        .view.active{display:block;}
        @keyframes viewIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}

        /* ========== SECTION LABELS ========== */
        .sec-label{display:flex;align-items:center;gap:10px;margin:22px 0 12px;}
        .sec-label span{font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;}
        .sec-label .line{flex:1;height:1px;background:var(--border);}
        .tag{padding:3px 9px;border-radius:20px;font-size:9px;font-weight:700;letter-spacing:0.05em;}
        .tag-req{background:rgba(239,68,68,0.08);color:#ef4444;border:1px solid rgba(239,68,68,0.15);}
        .tag-opt{background:var(--bg-input);color:var(--text-muted);border:1px solid var(--border);}

        /* ========== UPLOAD CARDS ========== */
        .upload-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .upload-grid.single{grid-template-columns:1fr;max-width:calc(50% - 6px);}

        .up-card{
            background:var(--bg-card);border:1px solid var(--border);
            border-radius:var(--radius);box-shadow:var(--shadow-sm);
            transition:all 0.25s var(--ease);overflow:hidden;
        }
        .up-card:hover{border-color:#c7d2fe;box-shadow:var(--shadow);transform:translateY(-1px);}
        .up-card.has-file{border-color:var(--success);background:#f0fdf9;}

        .up-zone{position:relative;padding:20px 16px 16px;text-align:center;cursor:pointer;transition:background 0.2s var(--ease);}
        .up-zone.dragover{background:var(--accent-bg);}
        .up-zone input[type="file"]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;}
        .up-icon{
            width:40px;height:40px;border-radius:10px;
            background:var(--bg-input);border:1px solid var(--border);
            display:flex;align-items:center;justify-content:center;
            font-size:18px;margin:0 auto 10px;
            transition:all 0.2s var(--ease);
        }
        .up-card:hover .up-icon{border-color:#c7d2fe;background:var(--accent-bg);}
        .up-card.has-file .up-icon{border-color:var(--success);background:var(--success-bg);}
        .up-label{font-size:13px;font-weight:700;color:var(--text);}
        .up-hint{font-size:10px;color:var(--text-muted);margin-top:3px;}
        .up-fname{
            font-size:10px;color:var(--success);font-weight:600;margin-top:7px;
            display:none;align-items:center;justify-content:center;gap:4px;word-break:break-all;
        }
        .up-fname::before{content:'\2713';font-size:12px;}
        .up-foot{display:flex;border-top:1px solid var(--border-light);}
        .samp-btn{
            flex:1;display:flex;align-items:center;justify-content:center;gap:5px;
            padding:8px;font-size:10px;font-weight:600;color:var(--text-muted);
            text-decoration:none;transition:all 0.2s var(--ease);background:transparent;
        }
        .samp-btn:hover{color:var(--accent);background:var(--accent-bg);}
        .samp-btn svg{width:12px;height:12px;}

        /* ========== BUTTONS ========== */
        .btn-primary{
            width:100%;padding:15px 24px;border:none;border-radius:var(--radius);
            font-family:'Inter',sans-serif;font-size:14px;font-weight:700;
            color:#fff;cursor:pointer;
            display:flex;align-items:center;justify-content:center;gap:9px;
            transition:all 0.25s var(--ease);margin-top:22px;
        }
        .btn-primary svg{width:16px;height:16px;}
        .btn-primary.purple{background:linear-gradient(135deg,#6366f1,#7c3aed);box-shadow:0 4px 20px rgba(99,102,241,0.3);}
        .btn-primary.blue{background:linear-gradient(135deg,#3b82f6,#6366f1);box-shadow:0 4px 20px rgba(59,130,246,0.3);}
        .btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 28px rgba(99,102,241,0.4);}
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed;box-shadow:none;transform:none;}

        .btn-download{
            width:100%;padding:14px 24px;border:none;border-radius:var(--radius);
            font-family:'Inter',sans-serif;font-size:14px;font-weight:700;color:#fff;cursor:pointer;
            background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 4px 18px rgba(16,185,129,0.25);
            display:flex;align-items:center;justify-content:center;gap:9px;
            text-decoration:none;transition:all 0.25s var(--ease);
        }
        .btn-download:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(16,185,129,0.35);}
        .btn-download svg{width:16px;height:16px;}

        /* ========== PROGRESS ========== */
        .prog-card{
            background:var(--bg-card);border:1px solid var(--border);
            border-radius:var(--radius-lg);padding:22px 20px;margin-top:22px;
            box-shadow:var(--shadow-sm);display:none;
        }
        .prog-top{display:flex;align-items:center;gap:14px;margin-bottom:14px;}
        .spinner{
            width:34px;height:34px;border-radius:50%;flex-shrink:0;
            border:3px solid #e0e7ff;border-top-color:var(--accent);
            animation:spin 0.8s linear infinite;
        }
        .spinner-sm{width:18px;height:18px;border-width:2px;margin:0;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .prog-label{font-size:13px;font-weight:600;color:var(--text);}
        .prog-sub{font-size:11px;color:var(--text-muted);margin-top:2px;}
        .prog-track{width:100%;height:5px;background:#e0e7ff;border-radius:99px;overflow:hidden;}
        .prog-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#6366f1,#818cf8);transition:width 0.5s ease;}
        .prog-pct{text-align:right;margin-top:6px;font-size:11px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;}

        /* ========== RESULTS ========== */
        .result-box{display:none;margin-top:22px;animation:viewIn 0.4s var(--ease);}
        .res-header{display:flex;align-items:center;gap:14px;margin-bottom:20px;}
        .res-check{
            width:40px;height:40px;border-radius:50%;
            background:linear-gradient(135deg,#10b981,#059669);
            display:flex;align-items:center;justify-content:center;
            font-size:17px;color:#fff;box-shadow:0 4px 14px rgba(16,185,129,0.25);flex-shrink:0;
        }
        .res-title{font-size:16px;font-weight:800;color:#065f46;}
        .res-sub{font-size:11px;color:var(--text-muted);margin-top:2px;}

        .stats-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;}
        .stat-card{border-radius:var(--radius);padding:14px 16px;border:1px solid transparent;}
        .stat-card.green{background:#ecfdf5;border-color:#a7f3d0;}
        .stat-card.amber{background:#fffbeb;border-color:#fde68a;}
        .stat-card.red{background:#fef2f2;border-color:#fecaca;}
        .stat-card.blue{background:#eff6ff;border-color:#bfdbfe;}
        .stat-top{display:flex;align-items:center;gap:7px;margin-bottom:6px;}
        .stat-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
        .green .stat-dot{background:#10b981;}.amber .stat-dot{background:#f59e0b;}.red .stat-dot{background:#ef4444;}.blue .stat-dot{background:#3b82f6;}
        .stat-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);}
        .stat-val{font-size:22px;font-weight:900;font-variant-numeric:tabular-nums;margin-bottom:3px;}
        .green .stat-val{color:#065f46;}.amber .stat-val{color:#92400e;}.red .stat-val{color:#991b1b;}.blue .stat-val{color:#1e40af;}
        .stat-amt{font-size:10px;color:var(--text-muted);line-height:1.6;}

        .anx-title{font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;}
        .anx-list{display:flex;flex-direction:column;gap:4px;margin-bottom:20px;max-height:440px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#e0e7ff transparent;}
        .anx-list::-webkit-scrollbar{width:4px;}.anx-list::-webkit-scrollbar-thumb{background:#e0e7ff;border-radius:4px;}
        .anx-item{
            display:flex;align-items:center;justify-content:space-between;
            padding:10px 14px;border-radius:8px;border:1px solid transparent;transition:background 0.15s;
        }
        .anx-item:hover{background:#f8fafc;}
        .anx-item.ok{background:#f0fdf4;border-color:#bbf7d0;}
        .anx-item.warn{background:#fffbeb;border-color:#fef08a;}
        .anx-item.danger{background:#fef2f2;border-color:#fecaca;}
        .anx-left{display:flex;align-items:center;gap:10px;}
        .anx-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
        .ok .anx-dot{background:var(--success);}.warn .anx-dot{background:var(--warning);}.danger .anx-dot{background:var(--danger);}
        .anx-name{font-size:11px;font-weight:700;color:var(--text);}
        .anx-desc{font-size:10px;color:var(--text-muted);margin-top:1px;}
        .anx-cnt{font-size:16px;font-weight:900;font-variant-numeric:tabular-nums;min-width:36px;text-align:right;}
        .ok .anx-cnt{color:#065f46;}.warn .anx-cnt{color:#92400e;}.danger .anx-cnt{color:#991b1b;}

        .meta-row{
            display:flex;justify-content:center;gap:36px;
            padding:12px;margin-bottom:16px;
            background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius);
        }
        .meta-val{font-size:15px;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;}
        .meta-lbl{font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-top:2px;text-align:center;}
        .meta-divider{width:1px;background:var(--border);}

        .err-card{
            background:#fef2f2;border:1px solid #fecaca;
            border-radius:var(--radius);padding:20px;display:flex;gap:14px;align-items:flex-start;
        }
        .err-icon{font-size:24px;flex-shrink:0;}.err-title{font-size:13px;font-weight:700;color:#991b1b;margin-bottom:4px;}
        .err-msg{font-size:12px;color:#b91c1c;line-height:1.5;word-break:break-word;}
        .retry-btn{
            width:100%;margin-top:14px;padding:12px;border:1px solid #c7d2fe;
            border-radius:10px;background:var(--accent-bg);color:var(--accent);
            font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;
        }
        .retry-btn:hover{background:#e0e7ff;}

        /* ========== HOME ========== */
        .home-hero{text-align:center;padding:44px 0 36px;}
        .home-logo{
            width:68px;height:68px;border-radius:18px;margin:0 auto 18px;
            background:linear-gradient(135deg,#6366f1,#8b5cf6);
            display:flex;align-items:center;justify-content:center;
            font-size:30px;box-shadow:0 8px 32px rgba(99,102,241,0.3);
        }
        .home-hero h1{
            font-size:28px;font-weight:900;letter-spacing:-1px;
            color:var(--text);margin-bottom:6px;
        }
        .home-hero p{font-size:14px;color:var(--text-muted);margin-bottom:36px;}
        .home-cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .home-card{
            background:var(--bg-card);border:1px solid var(--border);
            border-radius:var(--radius-lg);padding:28px 22px 24px;
            text-align:center;cursor:pointer;transition:all 0.3s var(--ease);
            box-shadow:var(--shadow-sm);text-decoration:none;color:var(--text);
        }
        .home-card:hover{border-color:#c7d2fe;transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .hc-icon{
            width:50px;height:50px;border-radius:14px;margin:0 auto 14px;
            display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;
        }
        .hc-icon.purple{background:linear-gradient(135deg,#6366f1,#8b5cf6);box-shadow:0 4px 14px rgba(99,102,241,0.25);}
        .hc-icon.blue{background:linear-gradient(135deg,#3b82f6,#6366f1);box-shadow:0 4px 14px rgba(59,130,246,0.25);}
        .hc-title{font-size:15px;font-weight:800;margin-bottom:8px;color:var(--text);}
        .hc-desc{font-size:12px;color:var(--text-muted);line-height:1.5;margin-bottom:14px;}
        .hc-tags{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;}
        .hc-tag{padding:3px 8px;border-radius:5px;font-size:9px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;background:var(--accent-bg);color:var(--accent);border:1px solid #e0e7ff;}

        /* --- ee --- */
        .ee-overlay{
            position:fixed;inset:0;z-index:9999;pointer-events:none;
            opacity:0;transition:opacity 0.6s;
            background:radial-gradient(ellipse at center,#0a0e2a 0%,#000 100%);
            display:flex;align-items:center;justify-content:center;
            flex-direction:column;overflow:hidden;
        }
        .ee-overlay.show{opacity:1;pointer-events:all;}
        .ee-canvas{position:absolute;inset:0;z-index:0;}
        .ee-content{position:relative;z-index:1;text-align:center;}
        .ee-glitch{
            font-size:13px;font-weight:700;letter-spacing:0.35em;text-transform:uppercase;
            color:#6366f1;margin-bottom:18px;
            animation:eeGlitch 0.12s infinite alternate;
        }
        @keyframes eeGlitch{
            0%{text-shadow:2px 0 #f43f5e,-2px 0 #3b82f6;transform:translate(0);}
            25%{text-shadow:-2px 0 #f43f5e,2px 0 #3b82f6;transform:translate(-1px,1px);}
            50%{text-shadow:1px -1px #f43f5e,-1px 1px #3b82f6;transform:translate(1px,0);}
            75%{text-shadow:-1px 1px #f43f5e,1px -1px #3b82f6;transform:translate(0,-1px);}
            100%{text-shadow:2px -1px #f43f5e,-2px 1px #3b82f6;transform:translate(-1px,0);}
        }
        .ee-name{
            font-size:42px;font-weight:900;letter-spacing:-1px;
            background:linear-gradient(135deg,#818cf8,#c084fc,#f472b6,#fb923c,#818cf8);
            background-size:300% 300%;
            -webkit-background-clip:text;-webkit-text-fill-color:transparent;
            animation:eeGrad 3s ease infinite;
            margin-bottom:10px;
            filter:drop-shadow(0 0 30px rgba(129,140,248,0.3));
        }
        @keyframes eeGrad{0%,100%{background-position:0% 50%;}50%{background-position:100% 50%;};}
        .ee-tagline{
            font-size:11px;color:rgba(148,163,184,0.7);letter-spacing:0.2em;
            text-transform:uppercase;font-weight:500;
        }
        .ee-line{
            width:60px;height:2px;margin:16px auto 0;border-radius:2px;
            background:linear-gradient(90deg,transparent,#6366f1,transparent);
            animation:eePulse 2s ease-in-out infinite;
        }
        @keyframes eePulse{0%,100%{opacity:0.3;width:40px;}50%{opacity:1;width:80px;}}
        .ee-particles{position:absolute;inset:0;overflow:hidden;z-index:0;}
        .ee-p{
            position:absolute;border-radius:50%;
            background:radial-gradient(circle,rgba(99,102,241,0.6),transparent 70%);
            animation:eeFloat linear infinite;
            pointer-events:none;
        }
        @keyframes eeFloat{
            0%{transform:translateY(100vh) scale(0);opacity:0;}
            10%{opacity:1;}
            90%{opacity:1;}
            100%{transform:translateY(-20vh) scale(1);opacity:0;}
        }

        @media(max-width:768px){
            .sidebar{width:56px;min-width:56px;}
            .brand-name,.brand-sub,.sidebar-section-label,.nav-label,.nav-badge,.sidebar-footer{display:none;}
            .sidebar-brand{padding:14px 9px;}
            .sidebar-section{padding:8px 6px 4px;}
            .nav-item{padding:8px;justify-content:center;}
            .main-content{padding:20px 14px 60px;}
            .upload-grid,.home-cards,.stats-row{grid-template-columns:1fr;}
            .upload-grid.single{max-width:100%;}
            :root{--sidebar-w:56px;}
        }
    </style>
</head>
<body>
    <aside class="sidebar">
        <div class="sidebar-brand">
            <div class="sidebar-brand-row" id="brandClick">
                <div class="brand-icon">&#x1f6e1;&#xfe0f;</div>
                <div><div class="brand-name">Dentalkart</div><div class="brand-sub">GST Compliance</div></div>
            </div>
        </div>
        <div class="sidebar-section">
            <div class="sidebar-section-label">Navigation</div>
            <div class="nav-item active" data-view="home" onclick="showView('home')">
                <div class="nav-icon">&#x1f3e0;</div><span class="nav-label">Dashboard</span>
            </div>
        </div>
        <div class="sidebar-section">
            <div class="sidebar-section-label">Tools</div>
            <div class="nav-item" data-view="compliance" onclick="showView('compliance')">
                <div class="nav-icon">&#x1f6e1;&#xfe0f;</div><span class="nav-label">ComplianceGuard</span><span class="nav-badge">17</span>
            </div>
            <div class="nav-item" data-view="gst2b" onclick="showView('gst2b')">
                <div class="nav-icon">&#x1f4ca;</div><span class="nav-label">GST 2B Reco</span>
            </div>
        </div>
        <div class="sidebar-footer"><p>&copy; 2026 Dentalkart</p></div>
    </aside>

    <main class="main">
        <div class="main-content">

            <!-- HOME -->
            <div class="view active" id="view-home">
                <div class="home-hero">
                    <div class="home-logo">&#x1f6e1;&#xfe0f;</div>
                    <h1>GST Compliance Suite</h1>
                    <p>Select a tool to get started</p>
                </div>
                <div class="home-cards">
                    <div class="home-card" onclick="showView('compliance')">
                        <div class="hc-icon purple">&#x1f6e1;&#xfe0f;</div>
                        <div class="hc-title">ComplianceGuard</div>
                        <div class="hc-desc">Invoice compliance analyzer with 17 annexures across Sales, E-Invoice, E-way Bill &amp; Credit Notes</div>
                        <div class="hc-tags"><span class="hc-tag">17 Annexures</span><span class="hc-tag">E-Invoice</span><span class="hc-tag">E-way Bill</span></div>
                    </div>
                    <div class="home-card" onclick="showView('gst2b')">
                        <div class="hc-icon blue">&#x1f4ca;</div>
                        <div class="hc-title">GST 2B Reconciliation</div>
                        <div class="hc-desc">Match GSTR-2B with Purchase Register to find matched, mismatched &amp; missing invoices</div>
                        <div class="hc-tags"><span class="hc-tag">GSTR-2B</span><span class="hc-tag">Purchase Register</span><span class="hc-tag">Matching</span></div>
                    </div>
                </div>
            </div>

            <!-- COMPLIANCE -->
            <div class="view" id="view-compliance">
                <div class="page-header">
                    <div class="page-icon purple">&#x1f6e1;&#xfe0f;</div>
                    <div><div class="page-title">ComplianceGuard</div><div class="page-subtitle">Invoice Compliance Analyzer &middot; 17 Annexures</div></div>
                </div>
                <div class="sec-label"><span>Required Files</span><span class="tag tag-req">Required</span><div class="line"></div></div>
                <div class="upload-grid">
                    <div class="up-card" id="c-card1"><div class="up-zone"><input type="file" id="c_sales" accept=".xlsx,.xls,.xlsb" onchange="uf(this,'c-card1','c-fn1')"><div class="up-icon">&#x1f4ca;</div><div class="up-label">Sales Data</div><div class="up-hint">Vinculum Export</div><div class="up-fname" id="c-fn1"></div></div><div class="up-foot"><a href="/sample/sales" class="samp-btn" download onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Sample</a></div></div>
                    <div class="up-card" id="c-card2"><div class="up-zone"><input type="file" id="c_einv" accept=".xlsx,.xls" onchange="uf(this,'c-card2','c-fn2')"><div class="up-icon">&#x1f9fe;</div><div class="up-label">E-Invoice</div><div class="up-hint">GST Portal Export</div><div class="up-fname" id="c-fn2"></div></div><div class="up-foot"><a href="/sample/einvoice" class="samp-btn" download onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Sample</a></div></div>
                </div>
                <div class="sec-label"><span>Optional Files</span><span class="tag tag-opt">Optional</span><div class="line"></div></div>
                <div class="upload-grid">
                    <div class="up-card" id="c-card3"><div class="up-zone"><input type="file" id="c_eway" accept=".xlsx,.xls" onchange="uf(this,'c-card3','c-fn3')"><div class="up-icon">&#x1f69a;</div><div class="up-label">E-way Bill</div><div class="up-hint">Outward + Inward</div><div class="up-fname" id="c-fn3"></div></div><div class="up-foot"><a href="/sample/ewaybill" class="samp-btn" download onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Sample</a></div></div>
                    <div class="up-card" id="c-card4"><div class="up-zone"><input type="file" id="c_cn" accept=".xlsx,.xls,.xlsb" onchange="uf(this,'c-card4','c-fn4')"><div class="up-icon">&#x1f4dd;</div><div class="up-label">Credit Note</div><div class="up-hint">Returns Data</div><div class="up-fname" id="c-fn4"></div></div><div class="up-foot"><a href="/sample/creditnote" class="samp-btn" download onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Sample</a></div></div>
                </div>
                <div class="sec-label"><span>CN E-Invoice (CDNR)</span><span class="tag tag-opt">Optional</span><div class="line"></div></div>
                <div class="upload-grid single">
                    <div class="up-card" id="c-card5"><div class="up-zone"><input type="file" id="c_cneinv" accept=".xlsx,.xls" onchange="uf(this,'c-card5','c-fn5')"><div class="up-icon">&#x1f4c4;</div><div class="up-label">CN E-Invoice</div><div class="up-hint">CDNR Export</div><div class="up-fname" id="c-fn5"></div></div><div class="up-foot"><a href="/sample/cn-einvoice" class="samp-btn" download onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Sample</a></div></div>
                </div>
                <button class="btn-primary purple" id="c-btn" onclick="runCompliance()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Run Compliance Check</button>
                <div class="prog-card" id="c-prog"><div class="prog-top"><div class="spinner"></div><div><div class="prog-label" id="c-prog-label">Uploading...</div><div class="prog-sub" id="c-prog-sub"></div></div></div><div class="prog-track"><div class="prog-fill" id="c-prog-bar" style="width:0%"></div></div><div class="prog-pct" id="c-prog-pct">0%</div></div>
                <div class="result-box" id="c-result"></div>
            </div>

            <!-- GST 2B -->
            <div class="view" id="view-gst2b">
                <div class="page-header">
                    <div class="page-icon blue">&#x1f4ca;</div>
                    <div><div class="page-title">GST 2B Reconciliation</div><div class="page-subtitle">Match GSTR-2B with Purchase Register</div></div>
                </div>
                <div class="sec-label"><span>Upload Files</span><span class="tag tag-req">Both Required</span><div class="line"></div></div>
                <div class="upload-grid">
                    <div class="up-card" id="g-card1"><div class="up-zone"><input type="file" id="g_2b" accept=".xlsx,.xls" onchange="uf(this,'g-card1','g-fn1')"><div class="up-icon">&#x1f4c2;</div><div class="up-label">GSTR-2B Data</div><div class="up-hint">GST Portal Export</div><div class="up-fname" id="g-fn1"></div></div><div class="up-foot"><a href="/gst2b/sample/gstr2b" class="samp-btn" download onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Sample</a></div></div>
                    <div class="up-card" id="g-card2"><div class="up-zone"><input type="file" id="g_pr" accept=".xlsx,.xls" onchange="uf(this,'g-card2','g-fn2')"><div class="up-icon">&#x1f4cb;</div><div class="up-label">Purchase Register</div><div class="up-hint">Books / Tally Export</div><div class="up-fname" id="g-fn2"></div></div><div class="up-foot"><a href="/gst2b/sample/purchase" class="samp-btn" download onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Sample</a></div></div>
                </div>
                <button class="btn-primary blue" id="g-btn" onclick="runGST2B()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Run Reconciliation</button>
                <div class="prog-card" id="g-prog"><div class="prog-top"><div class="spinner"></div><div><div class="prog-label">Reconciling data...</div><div class="prog-sub">Matching invoices across 2B and Books</div></div></div></div>
                <div class="result-box" id="g-result"></div>
            </div>
        </div>
    </main>

    <div class="ee-overlay" id="eeOverlay">
        <div class="ee-particles" id="eeParticles"></div>
        <canvas class="ee-canvas" id="eeCanvas"></canvas>
        <div class="ee-content">
            <div class="ee-glitch" id="eeGlitch">initializing</div>
            <div class="ee-name" id="eeName"></div>
            <div class="ee-tagline" id="eeTag"></div>
            <div class="ee-line"></div>
        </div>
    </div>

<script>
const API=window.location.origin;
const ANX_META={annexure_1_count:{name:'Annexure 1',desc:'E-Invoice vs Sales Amount Mismatch',danger:false},annexure_2_count:{name:'Annexure 2',desc:'B2B Invoices Missing in E-Invoice',danger:true},annexure_3_count:{name:'Annexure 3',desc:'E-Invoices Missing in Sales Data',danger:false},annexure_4_count:{name:'Annexure 4',desc:'Sales >= 50K Missing E-way Bill',danger:true},annexure_5_count:{name:'Annexure 5',desc:'E-Invoice >= 50K No E-way Bill',danger:false},annexure_6_count:{name:'Annexure 6',desc:'E-way Bills Missing in Sales',danger:false},annexure_7_count:{name:'Annexure 7',desc:'E-way Bills (GST) Not in E-Invoice',danger:false},annexure_8_count:{name:'Annexure 8',desc:'TES SKU with E-Invoice/E-way Bill',danger:true},annexure_9_count:{name:'Annexure 9',desc:'Administration Order Channel',danger:false},annexure_10_count:{name:'Annexure 10',desc:'High Discount (>= 90%)',danger:true},annexure_11_count:{name:'Annexure 11',desc:'Zero OrderAmount Invoices',danger:false},annexure_12_count:{name:'Annexure 12',desc:'CDNR Missing in Credit Note',danger:true},annexure_13_count:{name:'Annexure 13',desc:'Credit Notes Missing in CDNR',danger:true},annexure_14_count:{name:'Annexure 14',desc:'CN >= 50K Missing E-way Inward',danger:false},annexure_15_count:{name:'Annexure 15',desc:'CDNR >= 50K Missing E-way Inward',danger:false},annexure_16_count:{name:'Annexure 16',desc:'E-way Inward Missing in CN',danger:false},annexure_17_count:{name:'Annexure 17',desc:'CDNR vs Credit Note Value Mismatch',danger:true}};

function showView(id){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    document.getElementById('view-'+id).classList.add('active');
    document.querySelector(`.nav-item[data-view="${id}"]`).classList.add('active');
    document.querySelector('.main').scrollTop=0;
    window.location.hash=id;
}
if(window.location.hash){const h=window.location.hash.slice(1);if(document.getElementById('view-'+h))showView(h);}

document.querySelectorAll('.up-zone').forEach(z=>{
    z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('dragover');});
    z.addEventListener('dragleave',()=>z.classList.remove('dragover'));
    z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('dragover');const inp=z.querySelector('input[type="file"]');if(e.dataTransfer.files.length){inp.files=e.dataTransfer.files;inp.dispatchEvent(new Event('change'));}});
});

function uf(inp,cardId,fnId){const f=inp.files[0];const fn=document.getElementById(fnId);fn.textContent=f?f.name:'';fn.style.display=f?'flex':'none';document.getElementById(cardId).classList.toggle('has-file',!!f);}
function fmt(n){return Number(n).toLocaleString('en-IN');}
function fmtA(n){return'\u20B9'+Number(n).toLocaleString('en-IN',{maximumFractionDigits:0});}

async function runCompliance(){
    const sales=document.getElementById('c_sales').files[0];const einv=document.getElementById('c_einv').files[0];
    if(!sales||!einv){alert('Please upload both Sales Data and E-Invoice files.');return;}
    const btn=document.getElementById('c-btn');const prog=document.getElementById('c-prog');const res=document.getElementById('c-result');
    btn.disabled=true;btn.innerHTML='<div class="spinner spinner-sm"></div>Uploading...';prog.style.display='block';res.style.display='none';
    setP('c',3,'Uploading files...','Sales: '+(sales.size/1048576).toFixed(1)+' MB');
    const fd=new FormData();fd.append('sales_file',sales);fd.append('einvoice_file',einv);
    const eway=document.getElementById('c_eway').files[0];if(eway)fd.append('ewaybill_file',eway);
    const cn=document.getElementById('c_cn').files[0];if(cn)fd.append('creditnote_file',cn);
    const cneinv=document.getElementById('c_cneinv').files[0];if(cneinv)fd.append('cn_einvoice_file',cneinv);
    let jobId;
    try{const r=await fetch(API+'/analyze',{method:'POST',body:fd});const d=await r.json();if(!d.job_id)throw new Error(d.error||'Failed');jobId=d.job_id;setP('c',10,'Processing...','');btn.innerHTML='<div class="spinner spinner-sm"></div>Processing...';}catch(e){showErr('c','Upload Failed',e.message);return;}
    const poll=setInterval(async()=>{try{const r=await fetch(API+'/status/'+jobId);const d=await r.json();setP('c',Math.max(d.pct||10,10),d.msg||'Processing...','');if(d.status==='done'){clearInterval(poll);showComplianceResult(d.result);}else if(d.status==='error'){clearInterval(poll);showErr('c','Processing Failed',d.result?.error||'Unknown');}}catch(e){}},1500);
}
function setP(prefix,pct,label,sub){document.getElementById(prefix+'-prog-bar').style.width=pct+'%';document.getElementById(prefix+'-prog-pct').textContent=pct+'%';if(label)document.getElementById(prefix+'-prog-label').textContent=label;if(sub!==undefined)document.getElementById(prefix+'-prog-sub').textContent=sub;}
function showComplianceResult(data){
    document.getElementById('c-prog').style.display='none';const res=document.getElementById('c-result');res.style.display='block';resetBtn('c');
    const s=data.summary;const dl=API+'/download/'+data.filename;const total=Object.keys(ANX_META).reduce((a,k)=>a+(s[k]||0),0);
    let rows='';for(const[key,meta]of Object.entries(ANX_META)){const cnt=s[key]||0;const cls=cnt===0?'ok':(meta.danger?'danger':'warn');rows+=`<div class="anx-item ${cls}"><div class="anx-left"><div class="anx-dot"></div><div><div class="anx-name">${meta.name}</div><div class="anx-desc">${meta.desc}</div></div></div><div class="anx-cnt">${fmt(cnt)}</div></div>`;}
    res.innerHTML=`<div class="res-header"><div class="res-check">&#x2713;</div><div><div class="res-title">Analysis Complete</div><div class="res-sub">${fmt(total)} issues across 17 annexures</div></div></div><div class="stats-row"><div class="stat-card green"><div class="stat-top"><div class="stat-dot"></div><span class="stat-lbl">B2B Sales</span></div><div class="stat-val">${fmt(s.total_sales_records)}</div></div><div class="stat-card blue"><div class="stat-top"><div class="stat-dot"></div><span class="stat-lbl">E-Invoice</span></div><div class="stat-val">${fmt(s.total_einvoice_records)}</div></div></div><div class="anx-title">Annexure Results</div><div class="anx-list">${rows}</div><a href="${dl}" target="_blank" class="btn-download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download Compliance Report</a>`;
}
async function runGST2B(){
    const f2b=document.getElementById('g_2b').files[0];const fpr=document.getElementById('g_pr').files[0];
    if(!f2b||!fpr){alert('Please upload both GSTR-2B and Purchase Register files.');return;}
    const btn=document.getElementById('g-btn');const prog=document.getElementById('g-prog');const res=document.getElementById('g-result');
    btn.disabled=true;btn.innerHTML='<div class="spinner spinner-sm"></div>Processing...';prog.style.display='block';res.style.display='none';
    const fd=new FormData();fd.append('file_2b',f2b);fd.append('file_pr',fpr);
    try{const r=await fetch(API+'/gst2b/reconcile',{method:'POST',body:fd});const data=await r.json();prog.style.display='none';res.style.display='block';resetBtn('g');
        if(data.success){const s=data.summary;const dl=API+data.download_url;
            res.innerHTML=`<div class="res-header"><div class="res-check">&#x2713;</div><div><div class="res-title">Reconciliation Complete</div><div class="res-sub">All invoices processed</div></div></div><div class="meta-row"><div><div class="meta-val">${fmt(s.total_2b_records)}</div><div class="meta-lbl">2B Records</div></div><div class="meta-divider"></div><div><div class="meta-val">${fmt(s.total_pr_records)}</div><div class="meta-lbl">Books Records</div></div></div><div class="stats-row"><div class="stat-card green"><div class="stat-top"><div class="stat-dot"></div><span class="stat-lbl">Matched</span></div><div class="stat-val">${fmt(s.matched_count)}</div><div class="stat-amt">Taxable ${fmtA(s.matched_taxable)}<br>Tax ${fmtA(s.matched_tax)}</div></div><div class="stat-card amber"><div class="stat-top"><div class="stat-dot"></div><span class="stat-lbl">Mismatched</span></div><div class="stat-val">${fmt(s.mismatched_count)}</div><div class="stat-amt">2B ${fmtA(s.mismatched_2b_taxable)}<br>Books ${fmtA(s.mismatched_books_taxable)}</div></div><div class="stat-card red"><div class="stat-top"><div class="stat-dot"></div><span class="stat-lbl">Not in 2B</span></div><div class="stat-val">${fmt(s.not_in_2b_count)}</div><div class="stat-amt">Taxable ${fmtA(s.not_in_2b_taxable)}<br>Tax ${fmtA(s.not_in_2b_tax)}</div></div><div class="stat-card blue"><div class="stat-top"><div class="stat-dot"></div><span class="stat-lbl">Not in Books</span></div><div class="stat-val">${fmt(s.not_in_books_count)}</div><div class="stat-amt">Taxable ${fmtA(s.not_in_books_taxable)}<br>Tax ${fmtA(s.not_in_books_tax)}</div></div></div><a href="${dl}" target="_blank" class="btn-download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download Reconciliation Report</a>`;
        }else{showErr('g','Reconciliation Failed',data.error||'Unknown error');}
    }catch(e){prog.style.display='none';res.style.display='block';resetBtn('g');showErr('g','Connection Error',e.message);}
}
function showErr(prefix,title,msg){const el=document.getElementById(prefix+'-result');el.style.display='block';document.getElementById(prefix+'-prog').style.display='none';resetBtn(prefix);el.innerHTML=`<div class="err-card"><div class="err-icon">&#x26a0;&#xfe0f;</div><div><div class="err-title">${title}</div><div class="err-msg">${msg}</div></div></div><button class="retry-btn" onclick="location.reload()">&#x21ba; Try Again</button>`;}
function resetBtn(prefix){const btn=document.getElementById(prefix+'-btn');btn.disabled=false;if(prefix==='c')btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Run Compliance Check';else btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Run Reconciliation';}

/* --- hidden sequence: press keys t-a-n-i-s-h in order --- */
const _sq=[84,65,78,73,83,72];let _si=0;
document.addEventListener('keydown',function(e){
    if(e.keyCode===_sq[_si]){_si++;if(_si===_sq.length){_si=0;launchEE();}}
    else{_si=e.keyCode===_sq[0]?1:0;}
});
/* also 7-tap on brand icon */
let _tc=0,_tt=0;
document.getElementById('brandClick').addEventListener('click',function(){
    const now=Date.now();if(now-_tt>2000)_tc=0;_tt=now;_tc++;
    if(_tc===7){_tc=0;launchEE();}
});

function launchEE(){
    const ov=document.getElementById('eeOverlay');
    if(ov.classList.contains('show'))return;

    /* particles */
    const pp=document.getElementById('eeParticles');pp.innerHTML='';
    for(let i=0;i<35;i++){
        const p=document.createElement('div');p.className='ee-p';
        const sz=Math.random()*6+2;
        const colors=['rgba(99,102,241,0.5)','rgba(192,132,252,0.4)','rgba(244,114,182,0.4)','rgba(56,189,248,0.4)'];
        p.style.cssText=`width:${sz}px;height:${sz}px;left:${Math.random()*100}%;
            background:radial-gradient(circle,${colors[i%4]},transparent 70%);
            animation-duration:${Math.random()*4+3}s;animation-delay:${Math.random()*2}s;`;
        pp.appendChild(p);
    }

    /* matrix rain on canvas */
    const cvs=document.getElementById('eeCanvas');
    const ctx=cvs.getContext('2d');
    cvs.width=window.innerWidth;cvs.height=window.innerHeight;
    const cols=Math.floor(cvs.width/14);
    const drops=Array(cols).fill(1);
    const chars='01TANISHQBAJAZ{}[];:<>/\\|!@#$%^&*+=~'.split('');
    let raf;
    function drawMatrix(){
        ctx.fillStyle='rgba(10,14,42,0.06)';ctx.fillRect(0,0,cvs.width,cvs.height);
        ctx.font='12px monospace';
        for(let i=0;i<cols;i++){
            const ch=chars[Math.floor(Math.random()*chars.length)];
            const x=i*14;const y=drops[i]*14;
            ctx.fillStyle=Math.random()>0.96?'#f472b6':Math.random()>0.5?'rgba(99,102,241,0.35)':'rgba(99,102,241,0.15)';
            ctx.fillText(ch,x,y);
            if(y>cvs.height&&Math.random()>0.975)drops[i]=0;
            drops[i]++;
        }
        raf=requestAnimationFrame(drawMatrix);
    }

    /* glitch text typing */
    const glitchEl=document.getElementById('eeGlitch');
    const nameEl=document.getElementById('eeName');
    const tagEl=document.getElementById('eeTag');
    const glitchWords=['decrypting...','access_granted','loading profile','> sudo reveal'];
    let gi=0;
    nameEl.textContent='';tagEl.textContent='';

    ov.classList.add('show');
    drawMatrix();

    /* phase 1: glitch words */
    const gInt=setInterval(()=>{
        glitchEl.textContent=glitchWords[gi]||'';gi++;
        if(gi>glitchWords.length){clearInterval(gInt);phase2();}
    },500);

    /* phase 2: type name */
    function phase2(){
        glitchEl.style.animation='none';glitchEl.textContent='> architect';
        const fullName='Tanishq Bajaj';let ci=0;
        const tInt=setInterval(()=>{
            nameEl.textContent=fullName.slice(0,ci+1)+(ci<fullName.length-1?'_':'');
            ci++;
            if(ci>=fullName.length){
                clearInterval(tInt);
                nameEl.textContent=fullName;
                setTimeout(phase3,400);
            }
        },80);
    }

    /* phase 3: tagline fade */
    function phase3(){
        tagEl.style.opacity='0';tagEl.style.transition='opacity 0.8s';
        tagEl.textContent='built different. built to last.';
        requestAnimationFrame(()=>tagEl.style.opacity='1');
        /* auto close after 5s */
        setTimeout(()=>{
            ov.classList.remove('show');
            cancelAnimationFrame(raf);
            ctx.clearRect(0,0,cvs.width,cvs.height);
            pp.innerHTML='';
        },5000);
    }

    /* click to dismiss early */
    ov.onclick=function(){
        ov.classList.remove('show');
        cancelAnimationFrame(raf);
        ctx.clearRect(0,0,cvs.width,cvs.height);
        pp.innerHTML='';ov.onclick=null;
    };
}
</script>
</body>
</html>'''
