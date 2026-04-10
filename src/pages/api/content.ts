import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';

export const prerender = false;

const CONTENT_DIR = path.join(process.cwd(), 'src', 'content');

// GET - Leer archivo
export const GET: APIRoute = async ({ url }) => {
  const type = url.searchParams.get('type');
  const file = url.searchParams.get('file');
  
  if (!type || !file) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Validar que el tipo sea válido
  const validTypes = ['ponentes', 'programa', 'talleres'];
  if (!validTypes.includes(type)) {
    return new Response(JSON.stringify({ error: 'Invalid type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const filePath = path.join(CONTENT_DIR, type, file);
    
    // Verificar que el archivo esté dentro del directorio permitido
    if (!filePath.startsWith(CONTENT_DIR)) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    
    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST - Guardar archivo
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { type, file, content } = body;
    
    if (!type || !file || content === undefined) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validar tipo
    const validTypes = ['ponentes', 'programa', 'talleres'];
    if (!validTypes.includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const filePath = path.join(CONTENT_DIR, type, file);
    
    // Verificar que el archivo esté dentro del directorio permitido
    if (!filePath.startsWith(CONTENT_DIR)) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verificar que el archivo existe
    try {
      await fs.access(filePath);
    } catch {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Guardar contenido
    await fs.writeFile(filePath, content, 'utf-8');
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
