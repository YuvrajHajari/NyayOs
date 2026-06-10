const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://idoklvlgykqedtvtbbwg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_PP92x-QEeMUnQwDs4sDwCg_gC9lzZLY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── ROUTES ───────────────────────────────────────────────────

// POST /cases — Bolna fires this at end of every call
app.post('/cases', async (req, res) => {
  try {
    const body = req.body;

    const required = ['issue_type', 'summary'];
    for (const field of required) {
      if (!body[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    const newCase = {
      case_id: 'case_' + uuidv4().split('-')[0],
      caller_name: body.caller_name || body.facts?.employee_name || 'Unknown',
      phone: body.phone || body.facts?.phone || '',
      language: body.language || 'en',
      issue_type: body.issue_type,
      location: body.location || body.facts?.area_or_address || '',
      summary: body.summary,
      facts: body.facts || {},
      documents_required: body.documents_required || [],
      document_templates: body.document_templates || [],
      status: body.status || 'new',
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

// GET /cases — Dashboard fetches all cases (with optional filters)
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

// GET /cases/:id — Full case detail
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

// PATCH /cases/:id/status — NGO worker manually updates status
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

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── START ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`NyayOS API running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
});