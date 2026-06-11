const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://idoklvlgykqedtvtbbwg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_PP92x-QEeMUnQwDs4sDwCg_gC9lzZLY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Helper: unwrap and parse Bolna's payload ─────────────────
function parseBody(raw) {
  // Bolna sends { case_json: "stringified JSON" }
  // But the string often gets truncated. We handle both cases.
  if (!raw.case_json) return raw; // already flat, use as-is

  if (typeof raw.case_json === 'object') return raw.case_json; // already parsed

  // It's a string — try clean parse first
  try {
    return JSON.parse(raw.case_json);
  } catch (e) {
    // Truncated — salvage what we can with regex
    const s = raw.case_json;
    const get = (key) => (s.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`)) || [])[1] || '';
    
    const salvaged = {
      caller_name: get('caller_name'),
      phone: get('phone'),
      language: get('language') || 'hi',
      issue_type: get('issue_type') || 'unpaid_salary',
      location: get('location'),
      summary: get('summary') || 'Case data received (truncated)',
      status: get('status') || 'info_needed',
      urgency: get('urgency') || 'medium',
      next_step: get('next_step'),
      transcript_summary: get('transcript_summary'),
      facts: {},
    };

    // Try to extract facts block
    const factsStart = s.indexOf('"facts"');
    if (factsStart !== -1) {
      const factsSub = s.slice(factsStart);
      const braceOpen = factsSub.indexOf('{');
      const braceClose = factsSub.indexOf('}');
      if (braceOpen !== -1 && braceClose !== -1) {
        try {
          salvaged.facts = JSON.parse(factsSub.slice(braceOpen, braceClose + 1));
        } catch(e2) {}
      }
    }

    console.warn('[parseBody] Truncated JSON salvaged. Keys:', Object.keys(salvaged));
    return salvaged;
  }
}

// ─── POST /cases ─────────────────────────────────────────────
app.post('/cases', async (req, res) => {
  try {
    const body = parseBody(req.body);

    // Fallback issue_type if still missing
    const issue_type = body.issue_type || 
                       body.facts?.issue_type || 
                       'unpaid_salary';

    const summary = body.summary || 
                    body.facts?.summary || 
                    'Case received from NyayOS voice agent';

    const newCase = {
      case_id: 'case_' + uuidv4().split('-')[0],
      caller_name: body.caller_name || body.facts?.employee_name || 'Unknown',
      phone: body.phone || body.facts?.phone || '',
      language: body.language || 'hi',
      issue_type,
      location: body.location || body.facts?.area_or_address || '',
      summary,
      facts: body.facts || {},
      documents_required: body.documents_required || [],
      document_templates: body.document_templates || [],
      status: body.status || 'draft_generated',
      urgency: body.urgency || 'medium',
      next_step: body.next_step || '',
      missing_fields: body.missing_fields || [],
      transcript_summary: body.transcript_summary || '',
      transcript: body.transcript || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('cases').insert([newCase]);
    if (error) throw error;

    console.log(`[POST /cases] Created: ${newCase.case_id} | ${newCase.issue_type} | ${newCase.caller_name}`);
    res.status(201).json({ case_id: newCase.case_id, status: 'created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── GET /cases ───────────────────────────────────────────────
app.get('/cases', async (req, res) => {
  try {
    let query = supabase
      .from('cases')
      .select('case_id, caller_name, issue_type, location, urgency, status, summary, next_step, created_at')
      .order('created_at', { ascending: false });

    const { issue_type, urgency, status } = req.query;
    if (issue_type) query = query.eq('issue_type', issue_type);
    if (urgency)    query = query.eq('urgency', urgency);
    if (status)     query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── GET /cases/:id ───────────────────────────────────────────
app.get('/cases/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('case_id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Case not found' });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── PATCH /cases/:id/status ──────────────────────────────────
app.patch('/cases/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['new', 'info_needed', 'draft_generated', 'submitted', 'followup_due', 'resolved'];

    if (!status) return res.status(400).json({ error: 'Missing status field' });
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('cases')
      .update({ status, updated_at })
      .eq('case_id', req.params.id)
      .select('case_id, status, updated_at')
      .single();

    if (error) return res.status(404).json({ error: 'Case not found' });
    console.log(`[PATCH /cases/${req.params.id}/status] → ${status}`);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`NyayOS API running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
});