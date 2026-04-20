/**
 * StreamFlex - Cloudflare Worker Proxy
 * 
 * Este script actúa como intermediario para ocultar la API Key de TMDB de la APK/App web.
 * 1. Ve a dash.cloudflare.com -> Workers & Pages
 * 2. Crea una aplicación -> Crear Worker
 * 3. Copia todo este código y pégalo.
 * 4. ¡Despliega y usa esa URL en tu BASE_URL de script.js!
 */

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // --- CONFIGURACIÓN ---
        // Aquí es donde escondemos la llave real, así jamás llegará a los teléfonos de tus usuarios.
        const TMDB_API_KEY = "808c0f44efd9afa0e316f4c383a0dc1e";
        const TMDB_BASE_URL = "https://api.themoviedb.org/3";
        // ---------------------

        // Redireccionamos la ruta a TheMovieDB
        // Ejemplo: Si el usuario llama a /movie/popular, nosotros construimos https://api.themoviedb.org/3/movie/popular
        const targetUrl = new URL(`${TMDB_BASE_URL}${url.pathname}`);
        
        // Copiamos todos los parámetros (, lenguaje, página, queries) que envía StreamFlex
        url.searchParams.forEach((value, key) => {
            // Ignoramos la key falsa que llega desde el frontend
            if (key !== "api_key") {
                targetUrl.searchParams.append(key, value);
            }
        });
        
        // Inyectamos de forma segura la API KEY real a nivel SERVIDOR
        targetUrl.searchParams.set("api_key", TMDB_API_KEY);

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*", // Puedes cambiar "*" por tu dominio específico para hacerlo aún más seguro
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        // Responder al Preflight (Cross-Origin)
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // Realizamos la solicitud real a TMDB
            const response = await fetch(targetUrl.toString(), request);
            const data = await response.json();
            
            // Devolvemos la información a la app con permisos CORS adecuados
            return new Response(JSON.stringify(data), {
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders
                }
            });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { 
                status: 500, 
                headers: { "Content-Type": "application/json", ...corsHeaders } 
            });
        }
    }
};
