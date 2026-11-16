// CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://bxuwammfdvswndhephaa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wYG-rNLFJRThuZMqf5K90w_MPq9fCfO';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.db = {
  users: [],
  materials: [],
  budgets: [],
  cuttingPlans: [],
  settings: {}
};

window.currentUser = null;

async function loadDB() {
  try {
    const { data: users } = await supabaseClient.from('users').select('*');
    const { data: materials } = await supabaseClient.from('materials').select('*');
    const { data: budgets } = await supabaseClient.from('budgets').select('*');
    const { data: cuts } = await supabaseClient.from('cutting_plans').select('*');
    const { data: settings } = await supabaseClient.from('settings').select('*').single();

    window.db.users = users || [];
    window.db.materials = materials || [];
    window.db.budgets = budgets || [];
    window.db.cuttingPlans = cuts || [];
    window.db.settings = settings || {};

    // Se não existir admin, cria um para o primeiro acesso
    if (window.db.users.length === 0) {
      const defaultAdmin = { name: 'Admin', email: 'admin@madprime.com', password: 'admin123', type: 'admin', active: true };
      await supabaseClient.from('users').insert([defaultAdmin]);
      window.db.users.push({ ...defaultAdmin, id: 'temp-id' });
    }

    // Se não existir configuração, cria uma
    if (!window.db.settings || !window.db.settings.company_name) {
      const defaultSettings = { id: 1, company_name: 'MAD PRIME', cnpj: '', whatsapp: '', whatsapp2: '', email: '', address: '', number_prefix: 'MP-2026-', validity_days: 15, default_conditions: '', logo: '' };
      await supabaseClient.from('settings').insert([defaultSettings]);
      window.db.settings = defaultSettings;
    }

  } catch (error) {
    console.error('Erro ao carregar dados do Supabase:', error);
    showToast('Erro de conexão com o banco.', 'error');
  }
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
