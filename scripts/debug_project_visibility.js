
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually read env file
let supabaseUrl = '';
let supabaseKey = '';

try {
    const envPath = path.resolve(__dirname, '../.env');
    const envContent = fs.readFileSync(envPath, 'utf8');

    // Simple parser
    envContent.split('\n').forEach(line => {
        if (line.startsWith('VITE_SUPABASE_URL=')) {
            supabaseUrl = line.split('=')[1].replace(/"/g, '').trim();
        }
        if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
            supabaseKey = line.split('=')[1].replace(/"/g, '').trim();
        }
    });
} catch (e) {
    console.error('Failed to read .env', e);
}

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugProjects() {
    console.log('--- Debugging Project Visibility ---');
    console.log('Target URL:', supabaseUrl);

    // 1. Try to fetch the mock project specifically
    const { data: project, error } = await supabase
        .from('projects')
        .select('id, code, name, user_id, status')
        .eq('id', 'MOCK-PRJ-001')
        .maybeSingle();

    if (error) {
        console.error('Error fetching mock project:', error.message);
    } else if (project) {
        console.log('✅ Mock Project Found via Anon Client:');
        console.log(JSON.stringify(project, null, 2));
        console.log('Project User ID:', project.user_id);
    } else {
        console.error('❌ Mock Project NOT found via Anon Client (RLS likely hiding it)');
    }

    // 2. Try to fetch ANY project
    const { data: allProjects, error: listError } = await supabase
        .from('projects')
        .select('id, code, name, user_id')
        .limit(5);

    if (listError) console.error("List error:", listError.message);

    if (allProjects) {
        console.log(`\nVisible Projects count: ${allProjects.length}`);
        if (allProjects.length > 0) console.table(allProjects);
    }
}

debugProjects();
