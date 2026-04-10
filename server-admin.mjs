#!/usr/bin/env node
/**
 * StarsTrek Admin Server
 * CMS autónomo sin dependencias externas
 * Permite editar archivos Markdown directamente desde el navegador
 */

import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  PORT: process.env.ADMIN_PORT || 3333,
  PASSWORD: process.env.ADMIN_PASSWORD || 'startrek2024',
  CONTENT_DIR: path.join(__dirname, 'src', 'content'),
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 horas
};

// Almacenamiento simple de sesiones (en memoria)
const sessions = new Map();

// ==================== UTILIDADES ====================

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function verifyToken(token) {
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.created > CONFIG.SESSION_DURATION) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) cookies[name] = decodeURIComponent(value);
  });
  return cookies;
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ==================== API HANDLERS ====================

async function handleLogin(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { password } = JSON.parse(body);
      const hashedInput = hashPassword(password);
      const expectedHash = hashPassword(CONFIG.PASSWORD);
      
      if (hashedInput === expectedHash) {
        const token = generateToken();
        sessions.set(token, { created: Date.now() });
        
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `admin_token=${token}; HttpOnly; Path=/; Max-Age=86400`
        });
        res.end(JSON.stringify({ success: true, token }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Contraseña incorrecta' }));
      }
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Datos inválidos' }));
    }
  });
}

async function handleLogout(req, res, token) {
  sessions.delete(token);
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Set-Cookie': 'admin_token=; HttpOnly; Path=/; Max-Age=0'
  });
  res.end(JSON.stringify({ success: true }));
}

async function listFiles(req, res) {
  const url = new URL(req.url, `http://localhost:${CONFIG.PORT}`);
  const type = url.searchParams.get('type');
  
  const validTypes = ['ponentes', 'programa', 'talleres'];
  if (!validTypes.includes(type)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Tipo inválido' }));
    return;
  }
  
  try {
    const dirPath = path.join(CONFIG.CONTENT_DIR, type);
    const files = await fs.readdir(dirPath);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    const fileData = await Promise.all(
      mdFiles.map(async (file) => {
        const filePath = path.join(dirPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        
        // Extraer título del frontmatter
        const titleMatch = content.match(/^nombre:\s*"([^"]+)"/m) ||
                          content.match(/^titulo:\s*"([^"]+)"/m) ||
                          content.match(/^dia:\s*"([^"]+)"/m) ||
                          [null, file.replace('.md', '')];
        
        return {
          filename: file,
          title: titleMatch[1],
          modified: stats.mtime,
          size: stats.size
        };
      })
    );
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ files: fileData }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

async function getFile(req, res) {
  const url = new URL(req.url, `http://localhost:${CONFIG.PORT}`);
  const type = url.searchParams.get('type');
  const filename = url.searchParams.get('file');
  
  if (!type || !filename) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Faltan parámetros' }));
    return;
  }
  
  // Sanitizar filename
  const safeFilename = path.basename(filename);
  const filePath = path.join(CONFIG.CONTENT_DIR, type, safeFilename);
  
  // Verificar que está dentro del directorio permitido
  if (!filePath.startsWith(CONFIG.CONTENT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Acceso denegado' }));
    return;
  }
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ content, filename: safeFilename, type }));
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Archivo no encontrado' }));
  }
}

async function saveFile(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { type, filename, content } = JSON.parse(body);
      
      if (!type || !filename || content === undefined) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Faltan datos' }));
        return;
      }
      
      // Sanitizar
      const safeFilename = path.basename(filename);
      const filePath = path.join(CONFIG.CONTENT_DIR, type, safeFilename);
      
      if (!filePath.startsWith(CONFIG.CONTENT_DIR)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Acceso denegado' }));
        return;
      }
      
      // Backup del archivo original
      try {
        const backupDir = path.join(__dirname, '.backups', type);
        await fs.mkdir(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `${safeFilename}.${timestamp}.bak`);
        const originalContent = await fs.readFile(filePath, 'utf-8');
        await fs.writeFile(backupPath, originalContent, 'utf-8');
      } catch (e) {
        // No existe archivo original o error de backup
      }
      
      // Guardar archivo
      await fs.writeFile(filePath, content, 'utf-8');
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Guardado correctamente' }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

async function createFile(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { type, filename, template } = JSON.parse(body);
      
      if (!type || !filename) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Faltan datos' }));
        return;
      }
      
      const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
      const filePath = path.join(CONFIG.CONTENT_DIR, type, safeFilename);
      
      // Verificar que no existe
      try {
        await fs.access(filePath);
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'El archivo ya existe' }));
        return;
      } catch {
        // No existe, continuamos
      }
      
      // Templates por tipo
      const templates = {
        ponentes: `---
nombre: "Nuevo Ponente"
rol: "Rol del ponente"
fotoRetrato: "/images/retratos/nuevo-ponente.svg"
bio: "Biografía del ponente..."
instagram: ""
orden: 99
galeria: []
---

Biografía extendida opcional aquí.
`,
        programa: `---
dia: "Día"
fecha: "Fecha"
horarios:
  - hora: "00:00"
    tipo: actividad
    titulo: "Nueva actividad"
    ponente: ""
    descripcion: "Descripción..."
    destacado: false
---

Descripción del día.
`,
        talleres: `---
titulo: "Nuevo Taller"
instructor: "Nombre instructor"
fecha: "Fecha"
hora: "00:00"
duracion: "2 horas"
aforo: "20 personas"
descripcion: "Descripción del taller..."
requisitos: []
destacado: false
---

Contenido adicional.
`
      };
      
      const content = templates[type] || templates.ponentes;
      await fs.writeFile(filePath, content, 'utf-8');
      
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, filename: safeFilename }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

async function deleteFile(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { type, filename } = JSON.parse(body);
      
      const safeFilename = path.basename(filename);
      const filePath = path.join(CONFIG.CONTENT_DIR, type, safeFilename);
      
      if (!filePath.startsWith(CONFIG.CONTENT_DIR)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Acceso denegado' }));
        return;
      }
      
      await fs.unlink(filePath);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

async function rebuildSite(req, res) {
  return new Promise((resolve) => {
    exec('npm run build', { 
      cwd: __dirname,
      timeout: 120000
    }, (error, stdout, stderr) => {
      if (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Error en build',
          details: error.message,
          stderr: stderr
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          output: stdout,
          errors: stderr 
        }));
      }
      resolve();
    });
  });
}

// ==================== SERVIR HTML ESTATICO ====================

async function serveAdminHTML(res) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin - StarsTrek</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    :root {
      --bg-primary: #0a0a0a;
      --bg-secondary: #1a1a1a;
      --bg-tertiary: #2a2a2a;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --success: #22c55e;
      --warning: #fbbf24;
      --danger: #dc2626;
      --text: #e5e5e5;
      --text-muted: #888;
      --border: rgba(255,255,255,0.1);
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text);
      min-height: 100vh;
    }
    
    /* LOGIN */
    .login-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #0a0a0a 100%);
    }
    
    .login-box {
      background: var(--bg-secondary);
      padding: 50px;
      border-radius: 16px;
      width: 100%;
      max-width: 400px;
      border: 1px solid var(--border);
      text-align: center;
    }
    
    .login-box h1 {
      font-size: 1.8rem;
      margin-bottom: 10px;
      background: linear-gradient(90deg, var(--accent), var(--warning));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .login-box p {
      color: var(--text-muted);
      margin-bottom: 30px;
    }
    
    .login-box input {
      width: 100%;
      padding: 15px;
      margin-bottom: 20px;
      border: 1px solid var(--border);
      background: var(--bg-primary);
      color: white;
      border-radius: 8px;
      font-size: 16px;
    }
    
    .login-box input:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn-primary {
      background: var(--accent);
      color: white;
      width: 100%;
    }
    
    .btn-primary:hover {
      background: var(--accent-hover);
    }
    
    .btn-success { background: var(--success); color: white; }
    .btn-danger { background: var(--danger); color: white; }
    .btn-warning { background: var(--warning); color: black; }
    
    /* MAIN APP */
    .app {
      display: none;
      min-height: 100vh;
    }
    
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: 280px;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
    }
    
    .sidebar-header {
      padding: 25px;
      border-bottom: 1px solid var(--border);
    }
    
    .sidebar-header h2 {
      font-size: 1.3rem;
      background: linear-gradient(90deg, var(--accent), var(--warning));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }
    
    .nav-section {
      margin-bottom: 25px;
    }
    
    .nav-section h3 {
      color: var(--text-muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
    }
    
    .nav-item:hover {
      background: var(--bg-tertiary);
    }
    
    .nav-item.active {
      background: var(--accent);
      color: white;
    }
    
    .nav-item .icon {
      font-size: 16px;
    }
    
    .sidebar-footer {
      padding: 20px;
      border-top: 1px solid var(--border);
    }
    
    .main-content {
      margin-left: 280px;
      padding: 30px;
      min-height: 100vh;
    }
    
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 25px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    
    .toolbar h1 {
      font-size: 1.5rem;
    }
    
    .toolbar-actions {
      display: flex;
      gap: 10px;
    }
    
    /* FILE LIST */
    .file-list {
      background: var(--bg-secondary);
      border-radius: 12px;
      border: 1px solid var(--border);
      overflow: hidden;
    }
    
    .file-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 15px 20px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .file-item:last-child {
      border-bottom: none;
    }
    
    .file-item:hover {
      background: var(--bg-tertiary);
    }
    
    .file-info h4 {
      font-size: 15px;
      margin-bottom: 4px;
    }
    
    .file-info span {
      font-size: 12px;
      color: var(--text-muted);
    }
    
    .file-actions {
      display: flex;
      gap: 8px;
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    .file-item:hover .file-actions {
      opacity: 1;
    }
    
    .btn-small {
      padding: 6px 12px;
      font-size: 12px;
    }
    
    /* EDITOR */
    .editor-container {
      background: var(--bg-secondary);
      border-radius: 12px;
      border: 1px solid var(--border);
      overflow: hidden;
    }
    
    .editor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-tertiary);
    }
    
    .editor-header h3 {
      font-size: 14px;
      color: var(--text-muted);
    }
    
    .editor textarea {
      width: 100%;
      min-height: 600px;
      padding: 20px;
      background: var(--bg-primary);
      color: var(--text);
      border: none;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 14px;
      line-height: 1.6;
      resize: vertical;
    }
    
    .editor textarea:focus {
      outline: none;
    }
    
    .editor-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      border-top: 1px solid var(--border);
      background: var(--bg-tertiary);
    }
    
    .status {
      font-size: 13px;
      color: var(--text-muted);
    }
    
    .status.saved {
      color: var(--success);
    }
    
    .status.error {
      color: var(--danger);
    }
    
    /* TOAST */
    .toast {
      position: fixed;
      bottom: 30px;
      right: 30px;
      padding: 15px 25px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 1000;
      animation: slideIn 0.3s ease;
    }
    
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    .toast.success { background: var(--success); }
    .toast.error { background: var(--danger); }
    .toast.warning { background: var(--warning); color: black; }
    
    /* EMPTY STATE */
    .empty-state {
      text-align: center;
      padding: 80px 20px;
      color: var(--text-muted);
    }
    
    .empty-state .icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
    
    .empty-state h3 {
      color: var(--text);
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <!-- LOGIN SCREEN -->
  <div class="login-container" id="loginScreen">
    <div class="login-box">
      <h1>⭐ StarsTrek Admin</h1>
      <p>Panel de administración de contenido</p>
      <input type="password" id="password" placeholder="Contraseña" autofocus>
      <button class="btn btn-primary" onclick="login()">Acceder</button>
    </div>
  </div>

  <!-- MAIN APP -->
  <div class="app" id="app">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>⭐ StarsTrek</h2>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <h3>Contenido</h3>
          <div class="nav-item active" onclick="loadSection('ponentes')">
            <span class="icon">📸</span>
            <span>Ponentes</span>
          </div>
          <div class="nav-item" onclick="loadSection('programa')">
            <span class="icon">📅</span>
            <span>Programa</span>
          </div>
          <div class="nav-item" onclick="loadSection('talleres')">
            <span class="icon">🎓</span>
            <span>Talleres</span>
          </div>
        </div>
        
        <div class="nav-section">
          <h3>Acciones</h3>
          <div class="nav-item" onclick="createNewFile()">
            <span class="icon">➕</span>
            <span>Nuevo archivo</span>
          </div>
          <div class="nav-item" onclick="rebuildSite()">
            <span class="icon">🔄</span>
            <span>Reconstruir sitio</span>
          </div>
        </div>
      </nav>
      
      <div class="sidebar-footer">
        <button class="btn btn-danger btn-small" onclick="logout()" style="width: 100%;">
          Cerrar sesión
        </button>
      </div>
    </aside>
    
    <main class="main-content">
      <div class="toolbar">
        <h1 id="sectionTitle">Ponentes</h1>
        <div class="toolbar-actions">
          <button class="btn btn-success" onclick="saveCurrentFile()" id="saveBtn" disabled>
            💾 Guardar
          </button>
        </div>
      </div>
      
      <div id="contentArea">
        <div class="file-list" id="fileList"></div>
      </div>
    </main>
  </div>

  <script>
    let currentSection = 'ponentes';
    let currentFile = null;
    let currentContent = '';
    let isDirty = false;
    
    // Verificar sesión al cargar
    async function checkSession() {
      try {
        const res = await fetch('/api/verify', { credentials: 'include' });
        if (res.ok) {
          showApp();
          loadSection('ponentes');
        }
      } catch (e) {
        console.log('No session');
      }
    }
    
    async function login() {
      const password = document.getElementById('password').value;
      
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
          credentials: 'include'
        });
        
        if (res.ok) {
          showApp();
          loadSection('ponentes');
        } else {
          showToast('Contraseña incorrecta', 'error');
        }
      } catch (e) {
        showToast('Error de conexión', 'error');
      }
    }
    
    function showApp() {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
    }
    
    async function logout() {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      location.reload();
    }
    
    async function loadSection(section) {
      currentSection = section;
      currentFile = null;
      
      // Actualizar navegación
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      event.target.closest('.nav-item').classList.add('active');
      
      // Actualizar título
      const titles = { ponentes: 'Ponentes', programa: 'Programa', talleres: 'Talleres' };
      document.getElementById('sectionTitle').textContent = titles[section];
      
      // Cargar lista de archivos
      try {
        const res = await fetch(\`/api/files?type=\${section}\`, { credentials: 'include' });
        const data = await res.json();
        renderFileList(data.files);
      } catch (e) {
        showToast('Error cargando archivos', 'error');
      }
    }
    
    function renderFileList(files) {
      const list = document.getElementById('fileList');
      
      if (files.length === 0) {
        list.innerHTML = \`
          <div class="empty-state">
            <div class="icon">📄</div>
            <h3>No hay archivos</h3>
            <p>Crea tu primer archivo usando el botón "Nuevo archivo"</p>
          </div>
        \`;
        return;
      }
      
      list.innerHTML = files.map(file => \`
        <div class="file-item" onclick="editFile('\${file.filename}')">
          <div class="file-info">
            <h4>\${file.title}</h4>
            <span>\${file.filename} • Modificado: \${new Date(file.modified).toLocaleDateString()}</span>
          </div>
          <div class="file-actions" onclick="event.stopPropagation()">
            <button class="btn btn-primary btn-small" onclick="editFile('\${file.filename}')">Editar</button>
            <button class="btn btn-danger btn-small" onclick="deleteFile('\${file.filename}')">Eliminar</button>
          </div>
        </div>
      \`).join('');
    }
    
    async function editFile(filename) {
      try {
        const res = await fetch(\`/api/file?type=\${currentSection}&file=\${filename}\`, {
          credentials: 'include'
        });
        const data = await res.json();
        
        currentFile = filename;
        currentContent = data.content;
        isDirty = false;
        
        document.getElementById('contentArea').innerHTML = \`
          <div class="editor-container">
            <div class="editor-header">
              <h3>\${filename}</h3>
              <span style="color: #666; font-size: 12px;">Markdown + YAML Frontmatter</span>
            </div>
            <div class="editor">
              <textarea id="editor" oninput="onEditorChange()">\${escapeHtml(data.content)}</textarea>
            </div>
            <div class="editor-footer">
              <span class="status" id="status">Listo para editar</span>
              <button class="btn btn-success" onclick="saveCurrentFile()">💾 Guardar cambios</button>
            </div>
          </div>
        \`;
        
        document.getElementById('saveBtn').disabled = false;
      } catch (e) {
        showToast('Error cargando archivo', 'error');
      }
    }
    
    function onEditorChange() {
      isDirty = true;
      document.getElementById('status').textContent = 'Cambios sin guardar...';
      document.getElementById('status').className = 'status warning';
    }
    
    async function saveCurrentFile() {
      if (!currentFile) return;
      
      const content = document.getElementById('editor').value;
      
      try {
        const res = await fetch('/api/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: currentSection,
            filename: currentFile,
            content
          }),
          credentials: 'include'
        });
        
        if (res.ok) {
          isDirty = false;
          currentContent = content;
          document.getElementById('status').textContent = '✓ Guardado correctamente';
          document.getElementById('status').className = 'status saved';
          showToast('Archivo guardado', 'success');
        } else {
          throw new Error('Error al guardar');
        }
      } catch (e) {
        document.getElementById('status').textContent = 'Error al guardar';
        document.getElementById('status').className = 'status error';
        showToast('Error al guardar', 'error');
      }
    }
    
    async function deleteFile(filename) {
      if (!confirm(\`¿Eliminar \${filename}? Esta acción no se puede deshacer.\`)) return;
      
      try {
        const res = await fetch('/api/file', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: currentSection, filename }),
          credentials: 'include'
        });
        
        if (res.ok) {
          showToast('Archivo eliminado', 'success');
          loadSection(currentSection);
        }
      } catch (e) {
        showToast('Error al eliminar', 'error');
      }
    }
    
    async function createNewFile() {
      const name = prompt('Nombre del archivo (sin .md):');
      if (!name) return;
      
      try {
        const res = await fetch('/api/file', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: currentSection,
            filename: name + '.md',
            template: true
          }),
          credentials: 'include'
        });
        
        if (res.ok) {
          showToast('Archivo creado', 'success');
          loadSection(currentSection);
        }
      } catch (e) {
        showToast('Error al crear archivo', 'error');
      }
    }
    
    async function rebuildSite() {
      if (!confirm('¿Reconstruir el sitio? Esto puede tardar unos minutos.')) return;
      
      showToast('Reconstruyendo sitio...', 'warning');
      
      try {
        const res = await fetch('/api/rebuild', {
          method: 'POST',
          credentials: 'include'
        });
        
        if (res.ok) {
          showToast('Sitio reconstruido correctamente', 'success');
        } else {
          throw new Error('Error en build');
        }
      } catch (e) {
        showToast('Error al reconstruir', 'error');
      }
    }
    
    function showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = \`toast \${type}\`;
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // Inicializar
    checkSession();
    
    // Prevenir cierre con cambios sin guardar
    window.addEventListener('beforeunload', (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  </script>
</body>
</html>`;
  
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

// ==================== ROUTER ====================

const server = http.createServer(async (req, res) => {
  setCORS(res);
  
  // Parse cookies
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.admin_token;
  const isAuthenticated = verifyToken(token);
  
  const url = new URL(req.url, `http://localhost:${CONFIG.PORT}`);
  const pathname = url.pathname;
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  try {
    // Public routes
    if (pathname === '/' || pathname === '/admin') {
      await serveAdminHTML(res);
      return;
    }
    
    // Auth routes (no requieren autenticación)
    if (pathname === '/api/login' && req.method === 'POST') {
      await handleLogin(req, res);
      return;
    }
    
    if (pathname === '/api/verify' && req.method === 'GET') {
      if (isAuthenticated) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ authenticated: true }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No autenticado' }));
      }
      return;
    }
    
    // Protected routes (requieren autenticación)
    if (!isAuthenticated) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No autenticado' }));
      return;
    }
    
    // Rutas protegidas
    switch (pathname) {
      case '/api/logout':
        if (req.method === 'POST') {
          await handleLogout(req, res, token);
        }
        break;
        
      case '/api/files':
        if (req.method === 'GET') {
          await listFiles(req, res);
        }
        break;
        
      case '/api/file':
        if (req.method === 'GET') {
          await getFile(req, res);
        } else if (req.method === 'POST') {
          await saveFile(req, res);
        } else if (req.method === 'PUT') {
          await createFile(req, res);
        } else if (req.method === 'DELETE') {
          await deleteFile(req, res);
        }
        break;
        
      case '/api/rebuild':
        if (req.method === 'POST') {
          await rebuildSite(req, res);
        }
        break;
        
      default:
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(CONFIG.PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║           ⭐ StarsTrek Admin Server                    ║
╠════════════════════════════════════════════════════════╣
║  🚀 Servidor iniciado en:                              ║
║     http://localhost:${CONFIG.PORT}                      ║
║                                                        ║
║  🔐 Contraseña por defecto: ${CONFIG.PASSWORD.padEnd(27)}║
║                                                        ║
║  📁 Directorio de contenido:                           ║
║     ${CONFIG.CONTENT_DIR.substring(0, 45).padEnd(47)}║
╚════════════════════════════════════════════════════════╝
  `);
});

// Manejo de errores
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Error: El puerto ${CONFIG.PORT} ya está en uso`);
    process.exit(1);
  }
  console.error('Server error:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Cerrando servidor...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n👋 Cerrando servidor...');
  server.close(() => {
    process.exit(0);
  });
});
