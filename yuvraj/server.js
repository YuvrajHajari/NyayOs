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

// Parse raw body first — Bolna may send unexpected content-type
app.use((req, res, next) => {
  let data = '';
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    if (!data) return next();
    // Try JSON parse
    try {
      req.body = JSON.parse(data);
      return next();
    } catch(e) {}
    // Try URL-encoded parse
    try {
      const params = new URLSearchParams(data);
      const obj = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      if (Object.keys(obj).length > 0) { req.body = obj; return next(); }
    } catch(e) {}
    // Leave as empty
    req.body = {};
    next();
  });
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Build document templates from facts ─────────────────────
function buildDocumentTemplates(facts) {
  const f = facts || {};
  const proofList = Array.isArray(f.proof_available)
    ? f.proof_available.join(', ')
    : (f.proof_available || '');

  return [
    {
      document_type: 'salary_demand_legal_notice_style',
      title: 'Demand for payment of pending salary and employment dues',
      template_name: 'Document 1: Salary Demand / Legal Notice-Style Draft To Employer',
      fields: {
        employee_name: f.employee_name || '',
        employee_address: f.area_or_address || '',
        phone: f.phone || '',
        employer_name: f.employer_name || '',
        employer_address: f.employer_address_or_work_location || '',
        notice_recipient: f.notice_recipient || 'HR',
        role: f.role || '',
        joining_date: f.joining_date || '',
        salary: f.agreed_salary || '',
        unpaid_period: f.unpaid_period || '',
        amount_due: f.total_due || '',
        other_dues: f.other_dues || 'none',
        prior_request: f.prior_payment_request || 'none',
        proof_list: proofList,
        deadline: '15 days',
      }
    },
    {
      document_type: 'labour_complaint',
      title: 'Complaint regarding non-payment of salary/wages',
      template_name: 'Document 2: Labour Officer / Labour Commissioner Complaint Draft',
      fields: {
        employee_name: f.employee_name || '',
        employee_address: f.area_or_address || '',
        phone: f.phone || '',
        employer_name: f.employer_name || '',
        work_location: f.employer_address_or_work_location || '',
        role: f.role || '',
        joining_date: f.joining_date || '',
        current_status: f.current_status || '',
        salary: f.agreed_salary || '',
        unpaid_period: f.unpaid_period || '',
        amount_due: f.total_due || '',
        other_dues: f.other_dues || 'none',
        prior_request: f.prior_payment_request || 'none',
        proof_list: proofList,
      }
    }
  ];
}

// ─── Parse Bolna's payload ────────────────────────────────────
function parseBody(raw) {
  console.log('[parseBody] content-type body keys:', Object.keys(raw));
  console.log('[parseBody] raw snippet:', JSON.stringify(raw).slice(0, 300));

  // If already flat with issue_type
  if (raw.issue_type) {
    console.log('[parseBody] Already flat body');
    return raw;
  }

  // Bolna sends { case_json: "stringified JSON" }
  if (raw.case_json !== undefined) {
    let cj = raw.case_json;

    // Already an object
    if (typeof cj === 'object') {
      console.log('[parseBody] case_json is already object');
      return cj;
    }

    // It's a string
    if (typeof cj === 'string') {
      // Try direct parse
      try {
        const parsed = JSON.parse(cj);
        console.log('[parseBody] Direct parse success, caller_name:', parsed.caller_name);
        return parsed;
      } catch(e) {
        console.log('[parseBody] Direct parse failed:', e.message);
      }

      // Try unescaping first
      try {
        const unescaped = cj.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        const parsed = JSON.parse(unescaped);
        console.log('[parseBody] Unescape+parse success, caller_name:', parsed.caller_name);
        return parsed;
      } catch(e) {
        console.log('[parseBody] Unescape parse failed:', e.message);
      }

      // Salvage truncated JSON with regex
      console.warn('[parseBody] Salvaging truncated JSON...');
      const s = cj;
      const get = (key) => {
        const m = s.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*?)"`));
        return m ? m[1].replace(/\\"/g, '"') : '';
      };

      const salvaged = {
        caller_name: get('caller_name'),
        phone: get('phone'),
        language: get('language') || 'hi',
        issue_type: get('issue_type') || 'unpaid_salary',
        location: get('location'),
        summary: get('summary') || 'Case received from NyayOS voice agent',
        status: get('status') || 'draft_generated',
        urgency: get('urgency') || 'medium',
        next_step: get('next_step'),
        transcript_summary: get('transcript_summary'),
        facts: {},
      };

      // Extract facts block — find the last } to handle nested objects
      const fi = s.indexOf('"facts"');
      if (fi !== -1) {
        const sub = s.slice(fi);
        const bo = sub.indexOf('{');
        if (bo !== -1) {
          // Find matching closing brace
          let depth = 0, bc = -1;
          for (let i = bo; i < sub.length; i++) {
            if (sub[i] === '{') depth++;
            else if (sub[i] === '}') { depth--; if (depth === 0) { bc = i; break; } }
          }
          if (bc !== -1) {
            try {
              salvaged.facts = JSON.parse(sub.slice(bo, bc + 1));
              console.log('[parseBody] Facts salvaged:', Object.keys(salvaged.facts));
            } catch(e2) {
              console.warn('[parseBody] Facts parse failed:', e2.message);
            }
          }
        }
      }

      return salvaged;
    }
  }

  console.warn('[parseBody] Unknown format, returning raw');
  return raw;
}

// ─── POST /cases ─────────────────────────────────────────────
app.post('/cases', async (req, res) => {
  try {
    console.log('[POST /cases] rawBody:', (req.rawBody || '').slice(0, 400));
    const body = parseBody(req.body);
    const facts = body.facts || {};

    console.log('[POST /cases] caller_name:', body.caller_name);
    console.log('[POST /cases] facts keys:', Object.keys(facts));

    const document_templates = buildDocumentTemplates(facts);

    const newCase = {
      case_id: 'case_' + uuidv4().split('-')[0],
      caller_name: body.caller_name || facts.employee_name || 'Unknown',
      phone: body.phone || facts.phone || '',
      language: body.language || 'hi',
      issue_type: body.issue_type || 'unpaid_salary',
      location: body.location || facts.area_or_address || '',
      summary: body.summary || 'Case received from NyayOS voice agent',
      facts,
      documents_required: body.documents_required || [
        'offer letter or employment proof',
        'salary slips or wage records',
        'bank statement',
        'WhatsApp/email messages',
        'ID card',
        'work logs'
      ],
      document_templates,
      status: body.status || 'draft_generated',
      urgency: body.urgency || 'medium',
      next_step: body.next_step || 'Submit complaint to Labour Commissioner',
      missing_fields: body.missing_fields || [],
      transcript_summary: body.transcript_summary || '',
      transcript: body.transcript || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('cases').insert([newCase]);
    if (error) throw error;

    console.log(`[POST /cases] Created: ${newCase.case_id} | ${newCase.caller_name}`);
    res.status(201).json({ case_id: newCase.case_id, status: 'created' });
  } catch (err) {
    console.error('[POST /cases] Error:', err);
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
    console.log(`[PATCH] ${req.params.id} → ${status}`);
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
});