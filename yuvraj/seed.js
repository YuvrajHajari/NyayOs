// Run once: node seed.js
// Populates the database with 6 realistic demo cases

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'cases.json');

const mockCases = [
  {
    case_id: "case_a1b2c3",
    caller_name: "Ravi Kumar",
    phone: "+919876543210",
    language: "hinglish",
    issue_type: "unpaid_salary",
    location: "Delhi",
    summary: "Ravi has not received salary for 2 months from employer ABC Pvt Ltd. Amount due is ₹24,000.",
    facts: {
      employer_name: "ABC Pvt Ltd",
      amount_due: "24000",
      months_unpaid: "2",
      proof_available: true
    },
    status: "draft_generated",
    urgency: "high",
    next_step: "Submit complaint to Labour Commissioner, Delhi",
    generated_document: "To,\nThe Labour Commissioner\nDelhi\n\nSub: Complaint regarding non-payment of wages\n\nRespected Sir/Madam,\n\nI, Ravi Kumar, employed at ABC Pvt Ltd, Delhi, write to bring to your notice that my employer has failed to pay my salary for the past 2 months. A total amount of ₹24,000 is due.\n\nI have tried to resolve this matter directly with my employer but have received no response. I request your kind intervention to ensure prompt payment of my dues under the Payment of Wages Act, 1936.\n\nProof of employment and salary records are available with me.\n\nYours faithfully,\nRavi Kumar\n+919876543210",
    transcript: "Agent: Hello, this is NyayOS. How can I help you today?\nCaller: Mera salary nahi mila 2 mahine se. Kya karna chahiye?\nAgent: I understand. Can you tell me your employer's name?\nCaller: ABC Pvt Ltd, Delhi mein hai.\nAgent: How much salary is due?\nCaller: 24000 rupees ka.",
    created_at: "2026-06-09T14:23:00.000Z",
    updated_at: "2026-06-09T14:25:00.000Z"
  },
  {
    case_id: "case_d4e5f6",
    caller_name: "Priya Sharma",
    phone: "+918765432109",
    language: "hindi",
    issue_type: "fir_refusal",
    location: "Mumbai",
    summary: "Police at Andheri station refused to file FIR for theft of ₹15,000 cash from Priya's shop on June 7.",
    facts: {
      police_station: "Andheri West PS",
      incident_type: "theft",
      date_of_refusal: "2026-06-08",
      witness_available: true
    },
    status: "new",
    urgency: "high",
    next_step: "File written complaint to SP Mumbai or approach Magistrate under CrPC Sec 156(3)",
    generated_document: "To,\nThe Superintendent of Police\nMumbai\n\nSub: Complaint against refusal to register FIR\n\nRespected Sir,\n\nI, Priya Sharma, wish to bring to your notice that on 08-Jun-2026, I approached Andheri West Police Station to file a complaint regarding theft of ₹15,000 from my shop. The duty officer refused to register my FIR without valid reason.\n\nThis is a violation of my rights under Section 154 CrPC. I request immediate registration of my FIR and appropriate action against the responsible officer.\n\nYours faithfully,\nPriya Sharma",
    transcript: "Agent: What is your issue today?\nCaller: Police ne mera FIR nahi likha. Mere dukaan mein chor ghus gaya.\nAgent: Which police station did you go to?\nCaller: Andheri West station.\nAgent: When did this happen?\nCaller: Kal, June 8 ko.",
    created_at: "2026-06-09T09:10:00.000Z",
    updated_at: "2026-06-09T09:10:00.000Z"
  },
  {
    case_id: "case_g7h8i9",
    caller_name: "Suresh Menon",
    phone: "+917654321098",
    language: "english",
    issue_type: "deposit_withheld",
    location: "Bangalore",
    summary: "Landlord Ramesh Rao is refusing to return ₹50,000 security deposit after Suresh vacated the flat in May.",
    facts: {
      landlord_name: "Ramesh Rao",
      deposit_amount: "50000",
      tenancy_duration: "18 months",
      vacated_date: "2026-05-30"
    },
    status: "draft_generated",
    urgency: "medium",
    next_step: "Send legal notice to landlord. File complaint at Rent Authority or Consumer Forum, Bangalore",
    generated_document: "LEGAL NOTICE\n\nTo,\nMr. Ramesh Rao\n[Landlord Address]\n\nSub: Demand for return of security deposit\n\nI, Suresh Menon, was a tenant at your property for 18 months. I vacated the premises on 30-May-2026 in good condition. Despite repeated requests, you have failed to return my security deposit of ₹50,000.\n\nYou are hereby called upon to refund the said amount within 15 days of receiving this notice, failing which I will be constrained to initiate legal proceedings before the Rent Authority/Consumer Forum, Bangalore.\n\nSuresh Menon",
    transcript: "Agent: How can I help you today?\nCaller: My landlord won't return my deposit. 50,000 rupees.\nAgent: How long were you renting the property?\nCaller: 18 months. I moved out on May 30th.\nAgent: Has the landlord given any reason?\nCaller: No, just ignoring my calls.",
    created_at: "2026-06-08T16:45:00.000Z",
    updated_at: "2026-06-08T17:00:00.000Z"
  },
  {
    case_id: "case_j0k1l2",
    caller_name: "Meena Devi",
    phone: "+916543210987",
    language: "hindi",
    issue_type: "pension_delay",
    location: "Lucknow",
    summary: "Meena's EPFO pension has not been received for 4 months. Last payment received in February 2026.",
    facts: {
      scheme_name: "EPFO",
      delay_duration: "4 months",
      last_received: "February 2026",
      application_reference: "PF/LKO/2024/78432"
    },
    status: "submitted",
    urgency: "high",
    next_step: "Escalate to District Collector and file on Centralised Public Grievance portal (pgportal.gov.in)",
    generated_document: "To,\nThe District Collector\nLucknow, Uttar Pradesh\n\nSub: Non-receipt of EPFO pension for 4 months\n\nRespected Sir/Madam,\n\nI, Meena Devi, am an EPFO pension beneficiary (Ref: PF/LKO/2024/78432). My pension has not been credited for the last 4 months since February 2026.\n\nDespite following up with the EPFO office, no resolution has been provided. I am a senior citizen dependent on this pension for basic necessities.\n\nI humbly request your intervention to ensure immediate release of my pending pension amount.\n\nYours faithfully,\nMeena Devi\n+916543210987",
    transcript: "Agent: NyayOS mein aapka swagat hai. Bataiye kya samasya hai?\nCaller: Meri pension 4 mahine se nahi aayi. EPFO wali.\nAgent: Aapka pension reference number hai?\nCaller: Haan, PF/LKO/2024/78432.",
    created_at: "2026-06-07T11:20:00.000Z",
    updated_at: "2026-06-10T08:30:00.000Z"
  },
  {
    case_id: "case_m3n4o5",
    caller_name: "Arjun Singh",
    phone: "+915432109876",
    language: "english",
    issue_type: "unpaid_salary",
    location: "Pune",
    summary: "Arjun's employer TechStart Solutions has not paid salary for 3 months. Total due ₹75,000.",
    facts: {
      employer_name: "TechStart Solutions",
      amount_due: "75000",
      months_unpaid: "3",
      proof_available: false
    },
    status: "info_needed",
    urgency: "high",
    next_step: "Collect any proof of employment (offer letter, email, WhatsApp messages). Then file with Labour Commissioner, Pune.",
    generated_document: "",
    transcript: "Agent: What's the issue you're facing?\nCaller: My company hasn't paid me for 3 months. 75,000 rupees.\nAgent: Do you have any proof of employment like an offer letter?\nCaller: No, it was an informal arrangement. No written contract.",
    created_at: "2026-06-10T07:15:00.000Z",
    updated_at: "2026-06-10T07:15:00.000Z"
  },
  {
    case_id: "case_p6q7r8",
    caller_name: "Fatima Begum",
    phone: "+914321098765",
    language: "hinglish",
    issue_type: "deposit_withheld",
    location: "Hyderabad",
    summary: "Landlord withholding ₹30,000 deposit claiming false damages after 2 years of tenancy.",
    facts: {
      landlord_name: "Venkat Reddy",
      deposit_amount: "30000",
      tenancy_duration: "24 months",
      vacated_date: "2026-06-01"
    },
    status: "resolved",
    urgency: "low",
    next_step: "Case resolved — deposit returned after legal notice was sent.",
    generated_document: "LEGAL NOTICE\n\nTo,\nMr. Venkat Reddy\n[Address]\n\nSub: Return of Security Deposit...\n[Full notice text]",
    transcript: "Agent: How can I help?\nCaller: Mere landlord ne deposit wapas nahi kiya. Bol raha hai damages hai but kuch nahi tha.\nAgent: Kitna deposit tha?\nCaller: 30,000. 2 saal raha main wahaan.",
    created_at: "2026-06-05T13:00:00.000Z",
    updated_at: "2026-06-10T09:00:00.000Z"
  }
];

fs.writeFileSync(DB_PATH, JSON.stringify({ cases: mockCases }, null, 2));
console.log(`✅ Seeded ${mockCases.length} demo cases into cases.json`);