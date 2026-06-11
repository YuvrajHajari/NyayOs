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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function buildDocumentTemplates(f) {
  const proofList = typeof f.proof_available === 'string'
    ? f.proof_available
    : Array.isArray(f.proof_available) ? f.proof_available.join(', ') : '';

  return [
    {
      document_type: 'salary_demand_legal_notice_style',
      title: 'Demand for payment of pending salary and employment dues',
      template_name: 'Document 1: Salary Demand / Legal Notice-Style Draft To Employer',
      fields: {
        employee_name: f.employee_name || '',
        employee_address: f.location || '',
        phone: f.phone || '',
        employer_name: f.employer_name || '',
        employer_address: f.employer_address || '',
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
        employee_address: f.location || '',
        phone: f.phone || '',
        employer_name: f.employer_name || '',
        work_location: f.employer_address || '',
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

app.post('/cases', async (req, res) => {
  try {
    const b = req.body;
    console.log('[POST] body keys:', Object.keys(b));
    console.log('[POST] body preview:', JSON.stringify(b).slice(0, 300));

    // Build facts from flat fields
    const facts = {
      employee_name: b.employee_name || b.caller_name || '',
      phone: b.phone || '',
      area_or_address: b.location || '',
      employer_name: b.employer_name || '',
      employer_address_or_work_location: b.employer_address || '',
      notice_recipient: b.notice_recipient || '',
      role: b.role || '',
      joining_date: b.joining_date || '',
      current_status: b.current_status || '',
      agreed_salary: b.agreed_salary || '',
      unpaid_period: b.unpaid_period || '',
      total_due: b.total_due || '',
      other_dues: b.other_dues || 'none',
      prior_payment_request: b.prior_payment_request || 'none',
      proof_available: b.proof_available || '',
    };

    const newCase = {
      case_id: 'case_' + uuidv4().split('-')[0],
      caller_name: b.caller_name || b.employee_name || 'Unknown',
      phone: b.phone || '',
      language: b.language || 'hi',
      issue_type: b.issue_type || 'unpaid_salary',
      location: b.location || '',
      summary: b.summary || 'Case received from NyayOS voice agent',
      facts,
      documents_required: [
        'offer letter or employment proof',
        'salary slips or wage records',
        'bank statement',
        'WhatsApp/email messages',
        'ID card',
        'work logs'
      ],
      document_templates: buildDocumentTemplates({ ...b, ...facts }),
      status: b.status || 'draft_generated',
      urgency: b.urgency || 'medium',
      next_step: b.next_step || 'Submit complaint to Labour Commissioner',
      missing_fields: [],
      transcript_summary: b.transcript_summary || '',
      transcript: '',
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

app.get('/cases/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cases').select('*').eq('case_id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Case not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/cases/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['new', 'info_needed', 'draft_generated', 'submitted', 'followup_due', 'resolved'];
    if (!status) return res.status(400).json({ error: 'Missing status' });
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('cases').update({ status, updated_at })
      .eq('case_id', req.params.id).select('case_id, status, updated_at').single();
    if (error) return res.status(404).json({ error: 'Case not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => console.log(`NyayOS API running on port ${PORT}`));