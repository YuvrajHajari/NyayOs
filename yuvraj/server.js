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

// Capture raw body before any parsing
app.use((req, res, next) => {
  let chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks).toString('utf8');
    console.log('[RAW BODY]:', req.rawBody.slice(0, 500));
    next();
  });
});

app.use(express.static(path.join(__dirname, 'public')));

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

function extractData(rawBody) {
  if (!rawBody) return {};

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(rawBody);
    console.log('[extract] Direct parse OK, keys:', Object.keys(parsed));

    // Unwrap case_json if present
    if (parsed.case_json) {
      const cj = parsed.case_json;
      if (typeof cj === 'object') return cj;
      if (typeof cj === 'string') {
        try {
          const inner = JSON.parse(cj);
          console.log('[extract] Inner parse OK, caller:', inner.caller_name);
          return inner;
        } catch(e) {
          console.warn('[extract] Inner parse failed, salvaging...');
          return salvage(cj);
        }
      }
    }

    return parsed;
  } catch(e) {
    console.warn('[extract] Direct parse failed:', e.message);
  }

  // Try URL-encoded
  try {
    const params = new URLSearchParams(rawBody);
    const obj = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    if (obj.case_json) {
      try {
        const inner = JSON.parse(obj.case_json);
        console.log('[extract] URL-encoded case_json parsed, caller:', inner.caller_name);
        return inner;
      } catch(e) {
        return salvage(obj.case_json);
      }
    }
    if (Object.keys(obj).length > 0) return obj;
  } catch(e) {}

  return {};
}

function salvage(s) {
  console.warn('[salvage] Running regex salvage...');
  const get = (key) => {
    const m = s.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*?)"`));
    return m ? m[1].replace(/\\"/g, '"') : '';
  };

  const result = {
    caller_name: get('caller_name'),
    phone: get('phone'),
    language: get('language') || 'hi',
    issue_type: get('issue_type') || 'unpaid_salary',
    location: get('location'),
    summary: get('summary') || 'Case received from NyayOS',
    status: get('status') || 'draft_generated',
    urgency: get('urgency') || 'medium',
    next_step: get('next_step'),
    transcript_summary: get('transcript_summary'),
    facts: {},
  };

  const fi = s.indexOf('"facts"');
  if (fi !== -1) {
    const sub = s.slice(fi);
    const bo = sub.indexOf('{');
    if (bo !== -1) {
      let depth = 0, bc = -1;
      for (let i = bo; i < sub.length; i++) {
        if (sub[i] === '{') depth++;
        else if (sub[i] === '}') { depth--; if (depth === 0) { bc = i; break; } }
      }
      if (bc !== -1) {
        try {
          result.facts = JSON.parse(sub.slice(bo, bc + 1));
          console.log('[salvage] Facts OK:', Object.keys(result.facts));
        } catch(e) {}
      }
    }
  }

  return result;
}

// POST /cases
app.post('/cases', async (req, res) => {
  try {
    const body = extractData(req.rawBody);
    const facts = body.facts || {};

    console.log('[POST] caller_name:', body.caller_name, '| facts keys:', Object.keys(facts));

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
      document_templates: buildDocumentTemplates(facts),
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

    console.log('[POST] Created:', newCase.case_id, '|', newCase.caller_name);
    res.status(201).json({ case_id: newCase.case_id, status: 'created' });
  } catch (err) {
    console.error('[POST] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /cases
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
    res.status(500).json({ error: err.message });
  }
});

// GET /cases/:id
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
    res.status(500).json({ error: err.message });
  }
});

// PATCH /cases/:id/status
app.patch('/cases/:id/status', async (req, res) => {
  try {
    let body = {};
    try { body = JSON.parse(req.rawBody || '{}'); } catch(e) {}

    const { status } = body;
    const valid = ['new', 'info_needed', 'draft_generated', 'submitted', 'followup_due', 'resolved'];
    if (!status) return res.status(400).json({ error: 'Missing status' });
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('cases')
      .update({ status, updated_at })
      .eq('case_id', req.params.id)
      .select('case_id, status, updated_at')
      .single();

    if (error) return res.status(404).json({ error: 'Case not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => console.log(`NyayOS API running on port ${PORT}`));