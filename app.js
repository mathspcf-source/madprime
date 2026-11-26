let currentPage = 'dashboard';
let budgetState = { cart: [], category: 'all', search: '', editId: null, editingNumber: '', mobileTab: 'catalog' };
let cutState = { editId: null, editNumber: '', items: [], unit: 'cm', materialPadrao: 'MDF Branco 15mm', name: '' };
let materialFilter = 'all';

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================
function uid(prefix = 'id') { return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
function formatCurrency(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function formatDate(iso) { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function escapeHtml(str) { if (!str) return ''; return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function formatWA(num) {
  if (!num) return '';
  const d = String(num).replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return num;
}

function openModal(title, contentHTML, isFullscreen = false) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-overlay" data-action="close-modal-overlay">
      <div class="modal ${isFullscreen ? 'fullscreen' : ''}" data-modal-content>
        <div class="modal-header">
          <button type="button" class="btn-back" data-action="close-modal"><i data-lucide="arrow-left"></i> Voltar</button>
          <h2>${escapeHtml(title)}</h2>
          <button type="button" class="modal-close" data-action="close-modal"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">${contentHTML}</div>
      </div>
    </div>`;
  lucide.createIcons();
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
function navigate(page) { currentPage = page; if (page === 'materials') materialFilter = 'all'; renderApp(); }

function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = renderShell();
  lucide.createIcons();
}

// ============================================================
// SHELL
// ============================================================
function renderShell() {
  const isAdmin = window.isAdminMode;
  const navItems = [
    { page: 'dashboard', icon: 'layout-dashboard', label: 'Início' },
    { page: 'budgets', icon: 'file-text', label: 'Orçamentos' },
    { page: 'cutting', icon: 'scissors', label: 'Cortes' },
    ...(isAdmin ? [{ page: 'clients', icon: 'users', label: 'Clientes' }, { page: 'materials', icon: 'package', label: 'Materiais' }] : []),
    { page: 'settings', icon: 'settings', label: isAdmin ? 'Config.' : 'Perfil' }
  ];
  const content = renderPageContent(isAdmin);

  return `
    <header class="mobile-header">
      <div class="logo"><i data-lucide="hammer"></i> MAD PRIME</div>
      <button type="button" class="btn-icon" data-action="logout"><i data-lucide="log-out"></i></button>
    </header>
    <div class="flex" style="flex:1; min-height:0;">
      <aside class="sidebar desktop-only">
        <div class="logo"><i data-lucide="hammer"></i> MAD PRIME</div>
        <nav class="sidebar-nav">
          ${navItems.map(item => `
            <button type="button" class="sidebar-item ${currentPage === item.page ? 'active' : ''}" data-action="navigate" data-page="${item.page}">
              <i data-lucide="${item.icon}"></i> ${item.label}
            </button>`).join('')}
        </nav>
        <div class="sidebar-footer">
          <div class="flex items-center gap-1 mb-1" style="padding:0 0.5rem;">
            <i data-lucide="user-circle" style="width:18px;height:18px;color:var(--text-secondary);"></i>
            <span style="font-size:0.85rem;color:var(--text-secondary);">${escapeHtml(window.currentUser.name)}</span>
          </div>
          <button type="button" class="sidebar-item" data-action="logout"><i data-lucide="log-out"></i> Sair</button>
          <div class="copyright" style="padding: 1rem 0 0 0; text-align: left; font-size: 0.65rem;">&copy; 2026 MAD PRIME</div>
        </div>
      </aside>
      <main class="main-content">
        ${content}
        <div class="copyright mobile-only">&copy; 2026 MAD PRIME - Todos os direitos reservados.</div>
      </main>
    </div>
    <nav class="bottom-nav mobile-only">
      ${navItems.map(item => `
        <button type="button" class="nav-item ${currentPage === item.page ? 'active' : ''}" data-action="navigate" data-page="${item.page}">
          <i data-lucide="${item.icon}"></i><span>${item.label}</span>
        </button>`).join('')}
    </nav>`;
}

function renderPageContent(isAdmin) {
  switch (currentPage) {
    case 'dashboard': return renderDashboard(isAdmin);
    case 'budgets': return renderBudgetsPage(isAdmin);
    case 'cutting': return renderCuttingPlansPage(isAdmin);
    case 'clients': return renderClientsPage();
    case 'materials': return renderMaterialsPage();
    case 'settings': return renderSettingsPage(isAdmin);
    default: return renderDashboard(isAdmin);
  }
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard(isAdmin) {
  let budgets = window.db.budgets;
  let cuts = window.db.cuttingPlans;
  if (!isAdmin) {
    budgets = budgets.filter(b => b.client_id === window.currentUser.id);
    cuts = cuts.filter(c => c.client_id === window.currentUser.id);
  }
  const total = budgets.length;
  const pending = budgets.filter(b => b.status === 'pending').length;
  const approved = budgets.filter(b => b.status === 'approved').length;
  const approvedValue = budgets.filter(b => b.status === 'approved').reduce((s, b) => s + b.total, 0);
  const totalClients = window.db.users.filter(u => u.type === 'client').length;
  const totalMaterials = window.db.materials.length;
  
  const recentCuts = [...cuts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);

  return `
    <h1 class="mb-2">Dashboard</h1>
    <p class="text-secondary mb-2">Bem-vindo, ${escapeHtml(window.currentUser.name)}!</p>
    
    <div class="stats-grid">
      <div class="stat-card"><span class="label">Orçamentos</span><span class="value primary">${total}</span></div>
      <div class="stat-card"><span class="label">Planos de Corte</span><span class="value primary">${cuts.length}</span></div>
      <div class="stat-card"><span class="label">Pendentes</span><span class="value yellow">${pending}</span></div>
      <div class="stat-card"><span class="label">Aprovados</span><span class="value green">${approved}</span></div>
      <div class="stat-card"><span class="label">Valor Aprovado</span><span class="value green">${formatCurrency(approvedValue)}</span></div>
      ${isAdmin ? `<div class="stat-card"><span class="label">Clientes</span><span class="value">${totalClients}</span></div><div class="stat-card"><span class="label">Materiais</span><span class="value">${totalMaterials}</span></div>` : ''}
    </div>
    
    ${recentCuts.length > 0 ? `
      <h2 class="mb-1" style="margin-top:1.5rem;">Planos de Corte Recentes</h2>
      <div class="list-item card" style="flex-direction:column; align-items:stretch; gap:0.3rem; padding:0.5rem 1rem;">
        ${recentCuts.map(c => `
          <div class="flex items-center justify-between" style="padding:0.5rem 0; border-bottom:1px solid var(--border);">
            <div class="info">
              <div class="title" style="font-size:0.88rem;">${escapeHtml(c.name || c.number)} ${isAdmin ? '· ' + escapeHtml(c.client_name) : ''}</div>
              <div class="sub">${formatDate(c.created_at)} · ${c.items.length} peças</div>
            </div>
            <span class="badge badge-${c.status}">${c.status === 'pending' ? 'Pendente' : c.status === 'approved' ? 'Aprovado' : 'Recusado'}</span>
          </div>`).join('')}
      </div>` : ''}
  `;
}

// ============================================================
// LISTAS
// ============================================================
function renderBudgetsPage(isAdmin) {
  let budgets = window.db.budgets;
  if (!isAdmin) budgets = budgets.filter(b => b.client_id === window.currentUser.id);
  budgets = [...budgets].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return `
    <div class="flex items-center gap-1 mb-2">
      <button type="button" class="btn-icon" data-action="navigate" data-page="dashboard" style="border:1px solid var(--border);"><i data-lucide="arrow-left"></i></button>
      <h1 style="margin:0;">Orçamentos</h1>
      ${!isAdmin ? `<button type="button" class="btn btn-primary" data-action="new-budget" style="margin-left:auto;"><i data-lucide="plus"></i> Novo</button>` : ''}
    </div>
    ${budgets.length === 0 ? '<p class="text-secondary">Nenhum orçamento encontrado.</p>' : ''}
    ${budgets.map(b => `
      <div class="card mb-1" style="padding:1rem;">
        <div class="flex items-center justify-between" style="flex-wrap:wrap; gap:0.5rem;">
          <div>
            <div class="flex items-center gap-1" style="flex-wrap:wrap;">
              <strong>${escapeHtml(b.number)}</strong>
              <span class="badge badge-${b.status}">${b.status === 'pending' ? 'Pendente' : b.status === 'approved' ? 'Aprovado' : 'Recusado'}</span>
            </div>
            <div class="sub text-secondary" style="font-size:0.82rem;">${isAdmin ? escapeHtml(b.client_name) + ' · ' : ''}${formatDate(b.created_at)}</div>
          </div>
          <div style="font-size:1.1rem; font-weight:700; color:var(--green);">${formatCurrency(b.total)}</div>
        </div>
        <div class="flex gap-1 mt-1" style="flex-wrap:wrap;">
          <button type="button" class="btn btn-sm btn-outline" data-action="view-budget" data-id="${b.id}"><i data-lucide="eye"></i> Ver</button>
          ${isAdmin && b.status === 'pending' ? `
            <button type="button" class="btn btn-sm btn-green" data-action="approve-budget" data-id="${b.id}"><i data-lucide="check"></i> Aprovar</button>
            <button type="button" class="btn btn-sm btn-red" data-action="refuse-budget" data-id="${b.id}"><i data-lucide="x"></i> Recusar</button>` : ''}
          ${!isAdmin && b.status === 'pending' ? `
            <button type="button" class="btn btn-sm btn-outline" data-action="edit-budget" data-id="${b.id}"><i data-lucide="pencil"></i> Editar</button>` : ''}
          ${isAdmin ? `
            <button type="button" class="btn btn-sm btn-red" data-action="delete-budget" data-id="${b.id}"><i data-lucide="trash-2"></i> Excluir</button>` : ''}
          <button type="button" class="btn btn-sm btn-outline" data-action="pdf-budget" data-id="${b.id}"><i data-lucide="file-down"></i> Baixar PDF</button>
          <button type="button" class="btn btn-sm btn-green" data-action="share-pdf-whatsapp" data-id="${b.id}"><i data-lucide="share-2"></i> WhatsApp</button>
        </div>
      </div>`).join('')}
  `;
}

function renderCuttingPlansPage(isAdmin) {
  let plans = window.db.cuttingPlans;
  if (!isAdmin) plans = plans.filter(c => c.client_id === window.currentUser.id);
  plans = [...plans].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return `
    <div class="flex items-center gap-1 mb-2">
      <button type="button" class="btn-icon" data-action="navigate" data-page="dashboard" style="border:1px solid var(--border);"><i data-lucide="arrow-left"></i></button>
      <h1 style="margin:0;">Planos de Corte</h1>
      ${!isAdmin ? `<button type="button" class="btn btn-primary" data-action="new-cut-plan" style="margin-left:auto;"><i data-lucide="plus"></i> Novo</button>` : ''}
    </div>
    ${plans.length === 0 ? '<p class="text-secondary">Nenhum plano de corte encontrado.</p>' : ''}
    ${plans.map(c => `
      <div class="card mb-1" style="padding:1rem;">
        <div class="flex items-center justify-between" style="flex-wrap:wrap; gap:0.5rem;">
          <div>
            <div class="flex items-center gap-1" style="flex-wrap:wrap;">
              <strong>${escapeHtml(c.name || c.number)}</strong>
              <span class="badge badge-${c.status}">${c.status === 'pending' ? 'Pendente' : c.status === 'approved' ? 'Aprovado' : 'Recusado'}</span>
              <span style="font-size:0.7rem; color:var(--text-secondary); border:1px solid var(--border); padding:0.1rem 0.4rem; border-radius:4px;">${(c.unit || 'cm').toUpperCase()}</span>
            </div>
            <div class="sub text-secondary" style="font-size:0.82rem;">${isAdmin ? escapeHtml(c.client_name) + ' · ' : ''}${formatDate(c.created_at)} · ${c.items.length} peças</div>
          </div>
        </div>
        <div class="flex gap-1 mt-1" style="flex-wrap:wrap;">
          <button type="button" class="btn btn-sm btn-outline" data-action="view-cut-plan" data-id="${c.id}"><i data-lucide="eye"></i> Ver</button>
          ${isAdmin && c.status === 'pending' ? `
            <button type="button" class="btn btn-sm btn-green" data-action="approve-cut-plan" data-id="${c.id}"><i data-lucide="check"></i> Aprovar</button>
            <button type="button" class="btn btn-sm btn-red" data-action="refuse-cut-plan" data-id="${c.id}"><i data-lucide="x"></i> Recusar</button>` : ''}
          ${!isAdmin && c.status === 'pending' ? `
            <button type="button" class="btn btn-sm btn-outline" data-action="edit-cut-plan" data-id="${c.id}"><i data-lucide="pencil"></i> Editar</button>` : ''}
          ${isAdmin ? `
            <button type="button" class="btn btn-sm btn-red" data-action="delete-cut-plan" data-id="${c.id}"><i data-lucide="trash-2"></i> Excluir</button>` : ''}
          <button type="button" class="btn btn-sm btn-outline" data-action="pdf-cut-plan" data-id="${c.id}"><i data-lucide="file-down"></i> Baixar PDF</button>
          <button type="button" class="btn btn-sm btn-green" data-action="share-cut-plan-whatsapp" data-id="${c.id}"><i data-lucide="share-2"></i> WhatsApp</button>
        </div>
      </div>`).join('')}
  `;
}

// ============================================================
// MÓDULOS DE ADMIN
// ============================================================
function renderClientsPage() {
  const clients = window.db.users.filter(u => u.type === 'client');
  return `
    <div class="flex items-center gap-1 mb-2">
      <button type="button" class="btn-icon" data-action="navigate" data-page="dashboard" style="border:1px solid var(--border);"><i data-lucide="arrow-left"></i></button>
      <h1 style="margin:0;">Clientes</h1>
      <button type="button" class="btn btn-primary" data-action="new-client" style="margin-left:auto;"><i data-lucide="plus"></i> Novo</button>
    </div>
    <input class="input mb-2" id="search-clients" placeholder="Buscar por nome ou documento...">
    <div id="clients-list">
      ${clients.map(c => `
        <div class="list-item">
          <div class="info"><div class="title">${escapeHtml(c.name)} ${!c.active ? '<span class="badge badge-refused">Inativo</span>' : ''}</div><div class="sub">${escapeHtml(c.email)} · ${escapeHtml(c.document || '—')}</div></div>
          <div class="actions">
            <button type="button" class="btn btn-sm btn-outline" data-action="edit-client" data-id="${c.id}"><i data-lucide="pencil"></i></button>
            <button type="button" class="btn btn-sm btn-outline" data-action="reset-password" data-id="${c.id}"><i data-lucide="key"></i></button>
            <button type="button" class="btn btn-sm ${c.active ? 'btn-outline' : 'btn-green'}" data-action="toggle-client" data-id="${c.id}"><i data-lucide="${c.active ? 'user-x' : 'user-check'}"></i></button>
            <button type="button" class="btn btn-sm btn-red" data-action="delete-client" data-id="${c.id}"><i data-lucide="trash-2"></i></button>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderMaterialsPage() {
  const materials = window.db.materials.filter(m => materialFilter === 'all' || m.category === materialFilter);
  return `
    <div class="flex items-center gap-1 mb-2">
      <button type="button" class="btn-icon" data-action="navigate" data-page="dashboard" style="border:1px solid var(--border);"><i data-lucide="arrow-left"></i></button>
      <h1 style="margin:0;">Materiais</h1>
      <button type="button" class="btn btn-primary" data-action="new-material" style="margin-left:auto;"><i data-lucide="plus"></i> Novo</button>
    </div>
    <input class="input mb-2" id="search-materials" placeholder="Buscar material...">
    
    <div class="category-chips mb-2" style="padding-bottom: 0.5rem;">
      ${['all', 'MDFs', 'Fitas', 'Ferragens', 'Puxadores', 'Outros'].map(c => `
        <button type="button" class="cat-chip ${materialFilter === c ? 'active' : ''}" data-action="filter-materials" data-cat="${c}">${c === 'all' ? 'Todos' : c}</button>
      `).join('')}
    </div>

    <div id="materials-list">
      ${materials.length === 0 ? '<p class="text-secondary text-center py-4">Nenhum material encontrado.</p>' : ''}
      ${materials.map(m => `
        <div class="list-item">
          <div class="info"><div class="title">${escapeHtml(m.name)} ${!m.active ? '<span class="badge badge-refused">Inativo</span>' : ''}</div><div class="sub">${escapeHtml(m.category)} · ${formatCurrency(m.price)} / ${escapeHtml(m.unit)}</div></div>
          <div class="actions">
            <button type="button" class="btn btn-sm btn-outline" data-action="edit-material" data-id="${m.id}"><i data-lucide="pencil"></i></button>
            <button type="button" class="btn btn-sm ${m.active ? 'btn-outline' : 'btn-green'}" data-action="toggle-material" data-id="${m.id}"><i data-lucide="${m.active ? 'eye-off' : 'eye'}"></i></button>
            <button type="button" class="btn btn-sm btn-red" data-action="delete-material" data-id="${m.id}"><i data-lucide="trash-2"></i></button>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderSettingsPage(isAdmin) {
  if (!isAdmin) return `<h1 class="mb-2">Meu Perfil</h1><div class="card"><p><strong>Nome:</strong> ${escapeHtml(window.currentUser.name)}</p><p><strong>E-mail:</strong> ${escapeHtml(window.currentUser.email)}</p></div>`;
  const s = window.db.settings;
  return `
    <div class="flex items-center gap-1 mb-2">
      <button type="button" class="btn-icon" data-action="navigate" data-page="dashboard" style="border:1px solid var(--border);"><i data-lucide="arrow-left"></i></button>
      <h1 style="margin:0;">Configurações</h1>
    </div>
    <div class="card mb-2">
      <h3 class="mb-1">Dados da Empresa</h3>
      <div class="flex flex-col gap-1">
        <div><label class="label">Nome</label><input class="input" id="cfg-companyName" value="${escapeHtml(s.company_name || 'MAD PRIME')}"></div>
        <div><label class="label">CNPJ</label><input class="input" id="cfg-cnpj" value="${escapeHtml(s.cnpj || '')}"></div>
        <div><label class="label">WhatsApp 1</label><input class="input" id="cfg-whatsapp" value="${escapeHtml(s.whatsapp || '')}" placeholder="79996505113"></div>
        <div><label class="label">WhatsApp 2</label><input class="input" id="cfg-whatsapp2" value="${escapeHtml(s.whatsapp2 || '')}" placeholder="79996929174"></div>
        <div><label class="label">E-mail</label><input class="input" id="cfg-email" value="${escapeHtml(s.email || '')}"></div>
        <div><label class="label">Endereço</label><textarea class="textarea" id="cfg-address">${escapeHtml(s.address || '')}</textarea></div>
        <div><label class="label">Prefixo de Numeração</label><input class="input" id="cfg-numberPrefix" value="${escapeHtml(s.number_prefix || '')}"></div>
        <div><label class="label">Observações Padrão</label><textarea class="textarea" id="cfg-defaultConditions">${escapeHtml(s.default_conditions || '')}</textarea></div>
        <div>
          <label class="label">Logo (Base64)</label>
          <input class="input" type="file" id="cfg-logo" accept="image/*">
          ${s.logo ? `<img src="${s.logo}" style="max-height:50px; margin-top:0.5rem; border-radius:6px;">` : ''}
        </div>
        <button type="button" class="btn btn-primary mt-1" data-action="save-settings"><i data-lucide="save"></i> Salvar Configurações</button>
      </div>
    </div>
    
    <div class="card mb-2">
      <h3 class="mb-1">Backup e Restauração</h3>
      <p class="text-secondary mb-2" style="font-size: 0.85rem;">Baixe uma cópia de segurança de todos os dados do sistema.</p>
      <div class="flex flex-col gap-1">
        <button type="button" class="btn btn-outline w-full" data-action="download-backup" style="justify-content: flex-start;">
          <i data-lucide="download"></i> Baixar Backup Completo
        </button>
      </div>
    </div>`;
}

// ============================================================
// MÓDULO DE PLANO DE CORTE (MODAIS)
// ============================================================
function openNewCutPlanModal() {
  cutState.editId = null;
  cutState.editNumber = '';
  cutState.unit = 'cm';
  cutState.materialPadrao = 'MDF Branco 15mm';
  cutState.name = '';
  cutState.items = Array.from({ length: 100 }, () => ({
    id: uid('item'), qty: '', height: '', width: '', top: false, bottom: false, left: false, right: false, obs: ''
  }));
  renderCutPlanModal();
}

function openEditCutPlanModal(planId) {
  const c = window.db.cuttingPlans.find(x => x.id === planId);
  if (!c) return;
  if (c.status !== 'pending') { showToast('Apenas planos pendentes podem ser editados.', 'warning'); return; }
  cutState.editId = c.id;
  cutState.editNumber = c.number;
  cutState.unit = c.unit || 'cm';
  cutState.materialPadrao = c.material_padrao || 'MDF Branco 15mm';
  cutState.name = c.name || '';
  
  const savedItems = c.items.map(i => ({ ...i }));
  const emptyItemsNeeded = 100 - savedItems.length;
  const emptyItems = Array.from({ length: Math.max(0, emptyItemsNeeded) }, () => ({
    id: uid('item'), qty: '', height: '', width: '', top: false, bottom: false, left: false, right: false, obs: ''
  }));
  cutState.items = [...savedItems, ...emptyItems];
  renderCutPlanModal();
}

function renderCutPlanModal() {
  const isEdit = !!cutState.editId;
  const materials = window.db.materials.filter(m => m.category === 'MDFs' && m.active);
  if (materials.length && !materials.some(m => m.name === cutState.materialPadrao)) {
    cutState.materialPadrao = materials[0].name;
  }

  openModal(isEdit ? `Editar ${cutState.editNumber}` : 'Novo Plano de Corte', `
    <div class="flex flex-col gap-2" style="height: 100%;">
      <div class="flex gap-1 mb-1" style="flex-wrap:wrap; align-items:flex-end;">
        <div style="flex: 2; min-width: 150px;">
          <label class="label" style="margin-bottom:0.2rem;">Nome do Projeto</label>
          <input type="text" class="input" id="cut-name-input" placeholder="Ex: Armário Cozinha" value="${escapeHtml(cutState.name)}">
        </div>
        <div style="flex: 1; min-width: 120px;">
          <label class="label" style="margin-bottom:0.2rem;">Material Principal</label>
          <select class="select" data-action="set-material">
            ${materials.map(m => `<option value="${escapeHtml(m.name)}" ${cutState.materialPadrao === m.name ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
          </select>
        </div>
        <div class="flex-shrink-0">
          <label class="label" style="margin-bottom:0.2rem;">Unidade</label>
          <div class="unit-toggle">
            <button type="button" class="unit-btn ${cutState.unit === 'mm' ? 'active' : ''}" data-action="set-unit" data-unit="mm">mm</button>
            <button type="button" class="unit-btn ${cutState.unit === 'cm' ? 'active' : ''}" data-action="set-unit" data-unit="cm">cm</button>
          </div>
        </div>
      </div>

      <div class="flex gap-1 mb-2" style="width: 100%;">
        <button type="button" class="btn btn-outline" data-action="close-modal" style="flex: 1; height: 38px;">
          <i data-lucide="arrow-left"></i> Voltar
        </button>
        <button type="button" class="btn btn-primary" data-action="${isEdit ? 'update-cut-plan' : 'save-cut-plan'}" style="flex: 2; height: 38px;">
          <i data-lucide="save"></i> Salvar Plano
        </button>
      </div>

      <div class="cut-items-container">
        <table class="cut-table">
          <thead>
            <tr>
              <th style="width: 8%;">Peça</th>
              <th style="width: 12%;">Qtd</th>
              <th style="width: 20%;">Alt. (${cutState.unit})</th>
              <th style="width: 20%;">Larg. (${cutState.unit})</th>
              <th style="width: 40%;">Fita</th>
            </tr>
          </thead>
          <tbody id="cut-tbody">
            ${cutState.items.map((item, idx) => renderCutRow(item, idx)).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `, true);
}

function renderCutRow(item, idx) {
  const isEmpty = !item.height && !item.width;
  return `
    <tr data-cut-row="${idx}" style="${isEmpty ? 'background: rgba(255,255,255,0.02);' : ''}">
      <td style="text-align:center; font-size:0.75rem; font-weight:600; color:var(--text-secondary);">${idx + 1}</td>
      <td><input type="number" class="input-qty" data-cut-field="qty" data-idx="${idx}" value="${item.qty}" min="1" placeholder="1"></td>
      <td><input type="number" class="input-dim" data-cut-field="height" data-idx="${idx}" value="${item.height}" placeholder="0"></td>
      <td><input type="number" class="input-dim" data-cut-field="width" data-idx="${idx}" value="${item.width}" placeholder="0"></td>
      <td style="padding: 0.5rem;">
        <div class="fita-container">
          <div class="fita-box">
            <div class="fita-piece">
              <span class="fita-title">A1</span>
              <button type="button" class="edge-left ${item.left ? 'active' : ''}" data-action="toggle-edge" data-idx="${idx}" data-edge="left" title="Fita na Altura 1 (Esquerda)"></button>
            </div>
          </div>
          <div class="fita-box">
            <div class="fita-piece">
              <span class="fita-title">A2</span>
              <button type="button" class="edge-right ${item.right ? 'active' : ''}" data-action="toggle-edge" data-idx="${idx}" data-edge="right" title="Fita na Altura 2 (Direita)"></button>
            </div>
          </div>
          <div class="fita-box">
            <div class="fita-piece">
              <span class="fita-title">L1</span>
              <button type="button" class="edge-bottom ${item.bottom ? 'active' : ''}" data-action="toggle-edge" data-idx="${idx}" data-edge="bottom" title="Fita na Largura 1 (Base)"></button>
            </div>
          </div>
          <div class="fita-box">
            <div class="fita-piece">
              <span class="fita-title">L2</span>
              <button type="button" class="edge-top ${item.top ? 'active' : ''}" data-action="toggle-edge" data-idx="${idx}" data-edge="top" title="Fita na Largura 2 (Topo)"></button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function updateCutItem(idx, field, value) {
  if (cutState.items[idx]) cutState.items[idx][field] = value;
}

function openCutPlanViewModal(planId) {
  const c = window.db.cuttingPlans.find(x => x.id === planId);
  if (!c) return;
  
  let html = '';
  c.items.forEach((item, idx) => {
    html += `
      <div style="border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
        <div class="flex justify-between items-center mb-1">
          <strong style="color:var(--primary);">Peça ${idx + 1}</strong>
          <span class="badge badge-pending">${item.qty || 1}x</span>
        </div>
        <p style="font-size:0.85rem; margin-bottom:0.2rem;"><strong>Dimensões:</strong> ${item.height}${c.unit || 'cm'} (A) x ${item.width}${c.unit || 'cm'} (L)</p>
        <p style="font-size:0.85rem; margin-bottom:0.2rem;"><strong>Fita:</strong> 
          ${item.left ? 'A1 ' : ''}${item.right ? 'A2 ' : ''}${item.bottom ? 'L1 ' : ''}${item.top ? 'L2' : ''}
          ${!item.top && !item.bottom && !item.left && !item.right ? 'Nenhuma' : ''}
        </p>
      </div>
    `;
  });

  openModal(`Plano: ${c.name || c.number}`, `
    <div class="flex flex-col gap-1">
      <p><strong>Cliente:</strong> ${escapeHtml(c.client_name)}</p>
      <p><strong>Material:</strong> ${escapeHtml(c.material_padrao || '—')}</p>
      <p><strong>Data:</strong> ${formatDate(c.created_at)}</p>
      <p><strong>Status:</strong> <span class="badge badge-${c.status}">${c.status === 'pending' ? 'Pendente' : c.status === 'approved' ? 'Aprovado' : 'Recusado'}</span></p>
      <p><strong>Unidade:</strong> ${(c.unit || 'cm').toUpperCase()}</p>
      <div class="mt-1">${html}</div>
      <div class="flex gap-1 mt-2" style="flex-wrap:wrap;">
        <button type="button" class="btn btn-sm btn-outline" data-action="pdf-cut-plan" data-id="${c.id}"><i data-lucide="file-down"></i> Baixar PDF</button>
        <button type="button" class="btn btn-sm btn-green" data-action="share-cut-plan-whatsapp" data-id="${c.id}"><i data-lucide="share-2"></i> Enviar via WhatsApp</button>
      </div>
    </div>
  `);
}

// ============================================================
// VISUALIZAR ORÇAMENTO
// ============================================================
function openBudgetViewModal(budgetId) {
  const b = window.db.budgets.find(x => x.id === budgetId);
  if (!b) return;
  
  let itemsHtml = b.items.map((i, idx) => `
    <div style="border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 0.6rem; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight:500; font-size:0.9rem;">${idx + 1}. ${escapeHtml(i.name)}</div>
        <div style="font-size:0.8rem; color:var(--text-secondary);">${formatCurrency(i.price)} / un.</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:600; font-size:0.9rem;">Qtd: ${i.qty}</div>
        <div style="font-weight:700; color:var(--green); font-size:0.9rem;">${formatCurrency(i.price * i.qty)}</div>
      </div>
    </div>
  `).join('');

  openModal(`Orçamento: ${b.number}`, `
    <div class="flex flex-col gap-1">
      <p><strong>Cliente:</strong> ${escapeHtml(b.client_name)}</p>
      <p><strong>Data:</strong> ${formatDate(b.created_at)}</p>
      <p><strong>Status:</strong> <span class="badge badge-${b.status}">${b.status === 'pending' ? 'Pendente' : b.status === 'approved' ? 'Aprovado' : 'Recusado'}</span></p>
      
      <h3 class="mt-2 mb-1">Itens do Orçamento</h3>
      <div style="max-height: 300px; overflow-y: auto; padding-right: 5px;">
        ${itemsHtml}
      </div>
      
      <div style="background:var(--card); border:1px solid var(--border); border-radius:var(--radius-sm); padding:1rem; margin-top:1rem; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:600; font-size:1rem;">Total:</span>
        <span style="font-weight:700; font-size:1.3rem; color:var(--green);">${formatCurrency(b.total)}</span>
      </div>

      <div class="flex gap-1 mt-2" style="flex-wrap:wrap;">
        <button type="button" class="btn btn-sm btn-outline" data-action="pdf-budget" data-id="${b.id}"><i data-lucide="file-down"></i> Baixar PDF</button>
        <button type="button" class="btn btn-sm btn-green" data-action="share-pdf-whatsapp" data-id="${b.id}"><i data-lucide="share-2"></i> Enviar via WhatsApp</button>
      </div>
    </div>
  `);
}

// ============================================================
// ORÇAMENTO (CARRINHO)
// ============================================================
function openNewBudgetModal() {
  budgetState.cart = []; budgetState.category = 'all'; budgetState.search = ''; budgetState.editId = null; budgetState.editingNumber = ''; budgetState.mobileTab = 'catalog';
  renderBudgetModal();
}
function openEditBudgetModal(id) {
  const b = window.db.budgets.find(x => x.id === id);
  if (!b || b.status !== 'pending') return;
  budgetState.cart = b.items.map(i => ({ ...i })); budgetState.category = 'all'; budgetState.search = ''; budgetState.editId = b.id; budgetState.editingNumber = b.number; budgetState.mobileTab = 'catalog';
  renderBudgetModal();
}

function renderBudgetModal() {
  const isEdit = !!budgetState.editId;
  const materials = window.db.materials.filter(m => m.active);
  const categories = ['all', ...new Set(materials.map(m => m.category))];
  
  openModal(isEdit ? `Editar ${budgetState.editingNumber}` : 'Novo Orçamento', `
    <div class="flex flex-col" style="height:100%;">
      <div class="budget-mobile-tabs mobile-only">
        <button type="button" class="btn-icon" data-action="close-modal" style="border:1px solid var(--border); margin-right:0.3rem;"><i data-lucide="arrow-left"></i></button>
        <button type="button" class="budget-tab ${budgetState.mobileTab === 'catalog' ? 'active' : ''}" data-action="budget-tab" data-tab="catalog">Catálogo</button>
        <button type="button" class="budget-tab ${budgetState.mobileTab === 'cart' ? 'active' : ''}" data-action="budget-tab" data-tab="cart">Carrinho</button>
      </div>
      <div class="budget-grid">
        <div class="catalog-panel ${budgetState.mobileTab === 'catalog' ? 'active' : ''}">
          <div class="panel-header"><h3><i data-lucide="package"></i> Catálogo</h3><span class="count-badge" id="catalog-count">0 itens</span></div>
          <div class="catalog-filters">
            <div class="search-box"><i data-lucide="search" class="search-icon"></i><input class="input" id="catalog-search-input" placeholder="Buscar material..." value="${escapeHtml(budgetState.search)}">${budgetState.search ? `<button type="button" class="clear-search" data-action="clear-catalog-search"><i data-lucide="x"></i></button>` : ''}</div>
            <div class="category-chips" id="catalog-categories">${categories.map(c => `<button type="button" class="cat-chip ${budgetState.category === c ? 'active' : ''}" data-action="catalog-category" data-cat="${c}">${c === 'all' ? 'Todos' : escapeHtml(c)}</button>`).join('')}</div>
          </div>
          <div class="catalog-scroll" id="catalog-list"></div>
        </div>
        <div class="cart-panel ${budgetState.mobileTab === 'cart' ? 'active' : ''}">
          <div class="panel-header"><h3><i data-lucide="shopping-cart"></i> Carrinho</h3><span class="count-badge" id="cart-count">0 itens</span></div>
          <div class="cart-body">
            <div class="cart-scroll" id="cart-items"></div>
            <div class="free-item-form"><input class="input input-desc" id="free-item-desc" placeholder="Item livre"><input class="input input-value" id="free-item-value" type="number" placeholder="R$"><button type="button" class="btn-add-free" data-action="add-free-item"><i data-lucide="plus"></i></button></div>
            <div class="cart-summary"><div class="summary-row"><span>Total</span><span class="value" id="summary-total">R$ 0,00</span></div></div>
          </div>
          <div class="cart-actions"><button type="button" class="btn-save-budget" data-action="${isEdit ? 'update-budget' : 'save-budget'}"><i data-lucide="save"></i> Salvar Orçamento</button></div>
        </div>
      </div>
    </div>
  `, true);
  refreshCatalog(); refreshCart();
}

function refreshCatalog() {
  const list = document.getElementById('catalog-list');
  const count = document.getElementById('catalog-count');
  if (!list) return;

  let filtered = window.db.materials.filter(m => m.active);
  if (budgetState.category !== 'all') filtered = filtered.filter(m => m.category === budgetState.category);
  if (budgetState.search) {
    const q = budgetState.search.toLowerCase();
    filtered = filtered.filter(m => m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
  }
  if (count) count.textContent = filtered.length + (filtered.length === 1 ? ' item' : ' itens');
  if (filtered.length === 0) {
    list.innerHTML = `<div class="catalog-empty"><i data-lucide="search-x" style="width:26px;height:26px;margin-bottom:0.4rem;opacity:0.5;"></i><br>Nenhum material encontrado</div>`;
    lucide.createIcons();
    return;
  }
  list.innerHTML = filtered.map(m => {
    return `
      <div class="catalog-item">
        <div class="info">
          <div class="name" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</div>
          <div class="meta" title="${escapeHtml(m.category)} · ${escapeHtml(m.unit)}"><span>${escapeHtml(m.category)}</span><span class="dot"></span><span>${escapeHtml(m.unit)}</span></div>
        </div>
        <span class="price">${formatCurrency(m.price)}</span>
        <button type="button" class="add-btn" data-action="add-to-cart" data-id="${m.id}" title="Adicionar">
          <i data-lucide="plus"></i>
        </button>
      </div>`;
  }).join('');
  lucide.createIcons();
}

function refreshCart() {
  const cartItemsEl = document.getElementById('cart-items');
  const cartCountEl = document.getElementById('cart-count');
  const totalEl = document.getElementById('summary-total');
  const saveBtn = document.querySelector('.btn-save-budget');
  if (!cartItemsEl) return;

  const totalQty = budgetState.cart.reduce((s, i) => s + i.qty, 0);
  const totalValue = budgetState.cart.reduce((s, i) => s + i.price * i.qty, 0);

  if (cartCountEl) cartCountEl.textContent = totalQty + (totalQty === 1 ? ' item' : ' itens');
  if (totalEl) totalEl.textContent = formatCurrency(totalValue);
  if (saveBtn) saveBtn.disabled = budgetState.cart.length === 0;

  if (budgetState.cart.length === 0) {
    cartItemsEl.innerHTML = `<div class="cart-empty"><div class="icon-circle"><i data-lucide="shopping-bag"></i></div><p>Carrinho vazio</p><small>Adicione itens do catálogo</small></div>`;
  } else {
    cartItemsEl.innerHTML = budgetState.cart.map((item, idx) => `
      <div class="cart-item">
        <div class="item-body">
          <div class="item-name ${item.materialId ? '' : 'free'}">${escapeHtml(item.name)}</div>
          <div class="item-unit">${formatCurrency(item.price)} / un.</div>
        </div>
        <div class="qty-control">
          <button type="button" data-action="dec-qty" data-idx="${idx}">−</button>
          <span>${item.qty}</span>
          <button type="button" data-action="inc-qty" data-idx="${idx}">+</button>
        </div>
        <div class="item-subtotal">${formatCurrency(item.price * item.qty)}</div>
        <button type="button" class="remove-btn" data-action="remove-cart-item" data-idx="${idx}" title="Remover"><i data-lucide="x"></i></button>
      </div>`).join('');
  }
  lucide.createIcons();
}

// ============================================================
// GERADOR DE PDF — A4 REAL COM PAGINAÇÃO HTML
// ============================================================
const A4_W_MM = 210;
const A4_H_MM = 297;
const A4_W_PX = Math.round((A4_W_MM / 25.4) * 96); // ≈794
const A4_H_PX = Math.round((A4_H_MM / 25.4) * 96); // ≈1123
const A4_PAD_TOP_PX = Math.round((15 / 25.4) * 96);
const A4_PAD_BOT_PX = Math.round((12 / 25.4) * 96);

function getCompanyInfo() {
  const s = window.db.settings || {};
  return {
    company_name: s.company_name || 'MAD PRIME',
    cnpj: s.cnpj || '49.788.369/0001-08',
    whatsapp: s.whatsapp || '79996505113',
    whatsapp2: s.whatsapp2 || '79996929174',
    email: s.email || 'contato@madprime.com',
    address: s.address || 'Av. Manoel Cruz, 277 – Bairro Dezoito do Forte, Aracaju – SE, CEP: 49.072-450',
    logo: s.logo || null,
    number_prefix: s.number_prefix || 'MP-2026-',
    default_conditions: s.default_conditions || ''
  };
}

function buildFitaPDF(i) {
  const bar = {
    left:   'top:-2mm; bottom:-2mm; left:-3mm; width:2mm;',
    right:  'top:-2mm; bottom:-2mm; right:-3mm; width:2mm;',
    bottom: 'left:-2mm; right:-2mm; bottom:-3mm; height:2mm;',
    top:    'left:-2mm; right:-2mm; top:-3mm; height:2mm;'
  };
  const box = (label, edge) => `
    <div style="display:inline-block; position:relative; width:9mm; height:9mm; box-sizing:border-box; border:0.5mm dashed #555; margin:0 2mm; vertical-align:middle; text-align:center; line-height:8mm; font-size:7pt; font-weight:800; color:#000; font-family:Inter, Arial, sans-serif;">
      ${label}
      ${i[edge] ? `<div style="position:absolute; ${bar[edge]} background:#e53935;"></div>` : ''}
    </div>`;
  return box('A1', 'left') + box('A2', 'right') + box('L1', 'bottom') + box('L2', 'top');
}

function pdfHeaderBlock(s) {
  const logoSVG = s.logo
    ? `<img src="${s.logo}" crossorigin="anonymous" style="max-height:12mm; max-width:40mm; object-fit:contain;">`
    : `<div style="background:#000000; color:#ffffff; padding:2mm 4mm; font-size:9pt; font-weight:700; letter-spacing:1mm; text-transform:uppercase; display:inline-block;">${escapeHtml(s.company_name)}</div>`;
  const handle = s.company_name.replace(/\s+/g, '');
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12mm;">
      <div>${logoSVG}</div>
      <div style="font-size:8pt; font-weight:700; color:#000000; letter-spacing:0.5mm; text-transform:uppercase;">@${escapeHtml(handle)}</div>
    </div>`;
}

function pdfCompactHeaderBlock(s, docLabel, numCurto, dateStr) {
  const logoSVG = s.logo
    ? `<img src="${s.logo}" crossorigin="anonymous" style="max-height:8mm; max-width:28mm; object-fit:contain;">`
    : `<div style="background:#000000; color:#ffffff; padding:1.5mm 3mm; font-size:8pt; font-weight:700; letter-spacing:1mm; text-transform:uppercase; display:inline-block;">${escapeHtml(s.company_name)}</div>`;
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5mm; padding-bottom:3mm; border-bottom:0.2mm solid #dddddd;">
      <div>${logoSVG}</div>
      <div style="font-size:9pt; color:#000000; text-align:right;">
        <strong>${escapeHtml(docLabel)}</strong> nº ${numCurto} · ${escapeHtml(dateStr)}
      </div>
    </div>`;
}

function pdfFooterBlock(s) {
  return `
    <div style="font-size:7.5pt; color:#000000; border-top:0.2mm solid #dddddd; padding-top:4mm; text-align:center;">
      <strong>${escapeHtml(s.company_name)}</strong> · CNPJ: ${escapeHtml(s.cnpj)} · ${escapeHtml(s.address)}
    </div>`;
}

function pdfDocTitleBlock(s, doc, dateStr, numCurto) {
  const wa1 = s.whatsapp ? formatWA(s.whatsapp) : '';
  const wa2 = s.whatsapp2 ? formatWA(s.whatsapp2) : '';
  return `
    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10mm;">
      <h1 style="font-size:26pt; font-weight:800; color:#000000; margin:0; letter-spacing:-0.5mm; line-height:1;">${doc}</h1>
      <div style="font-size:11pt; font-weight:600; color:#000000;">${dateStr}</div>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8mm;">
      <div style="font-size:9pt; color:#000000; line-height:1.5;">
        ${escapeHtml(s.email)}<br>${escapeHtml(s.address)}<br>${wa1 ? `WhatsApp: ${wa1}` : ''} ${wa2 ? ` | ${wa2}` : ''}
      </div>
      <div style="font-size:14pt; font-weight:300; color:#000000;">nº <strong style="font-weight:700;">${numCurto}</strong></div>
    </div>`;
}

function pdfMetaBlock(extra) {
  return `<div style="margin-bottom:6mm; font-size:9.5pt; display:flex; justify-content:space-between; align-items:flex-start;">${extra}</div>`;
}

function pdfCompactMetaBlockCut(c, unitLabel) {
  return `
    <div style="margin-bottom:4mm; font-size:9pt; display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <div><strong>Cliente:</strong> ${escapeHtml(c.client_name)}</div>
        <div style="margin-top:0.5mm;"><strong>Material:</strong> ${escapeHtml(c.material_padrao || '—')}</div>
      </div>
      <div style="font-weight:700; border:0.3mm solid #000; padding:0.5mm 2mm; border-radius:1mm;">Medidas em ${unitLabel}</div>
    </div>`;
}

function pdfCompactMetaBlockBudget(b) {
  return `<div style="margin-bottom:4mm; font-size:9pt;"><strong>Cliente:</strong> ${escapeHtml(b.client_name)}</div>`;
}

function pdfTableHeadCutPlan(unitLabel) {
  return `
    <thead>
      <tr style="background:#000000; color:#ffffff;">
        <th style="text-align:center; padding:2mm 1mm; width:12mm; border-radius:1mm 0 0 1mm;">Peça</th>
        <th style="text-align:center; padding:2mm 1mm; width:15mm;">Qtd</th>
        <th style="text-align:center; padding:2mm 1mm; width:25mm;">Alt (${unitLabel})</th>
        <th style="text-align:center; padding:2mm 1mm; width:25mm;">Larg (${unitLabel})</th>
        <th style="text-align:center; padding:2mm 1mm; width:55mm; border-radius:0 1mm 1mm 0;">Fita</th>
      </tr>
    </thead>`;
}

function pdfTableHeadBudget() {
  return `
    <thead>
      <tr style="background:#000000; color:#ffffff;">
        <th style="text-align:center; padding:2mm 1mm; width:10mm; border-radius:1mm 0 0 1mm;">Nº</th>
        <th style="text-align:left; padding:2mm 1mm;">Material</th>
        <th style="text-align:center; padding:2mm 1mm; width:13mm;">Qtd</th>
        <th style="text-align:right; padding:2mm 1mm; width:25mm;">Preço</th>
        <th style="text-align:right; padding:2mm 1mm; width:25mm; border-radius:0 1mm 1mm 0;">Total</th>
      </tr>
    </thead>`;
}

async function measureBlockHeight(html) {
  const probe = document.createElement('div');
  probe.style.position = 'fixed';
  probe.style.left = '-9999px';
  probe.style.top = '0';
  probe.style.width = `${A4_W_PX - 2 * A4_PAD_TOP_PX}px`;
  probe.style.background = '#fff';
  probe.style.visibility = 'hidden';
  probe.innerHTML = html;
  document.body.appendChild(probe);
  const h = probe.offsetHeight;
  probe.remove();
  return h;
}

function buildA4Page(headerHTML, bodyHTML, footerHTML) {
  return `
    <div style="
      width:${A4_W_MM}mm;
      height:${A4_H_MM}mm;
      box-sizing:border-box;
      padding:15mm 15mm 12mm 15mm;
      background:#ffffff;
      color:#000000;
      font-family:'Inter', Arial, sans-serif;
      font-size:10pt;
      line-height:1.4;
      display:flex;
      flex-direction:column;
      overflow:hidden;
    ">
      ${headerHTML}
      <div style="flex:1; overflow:hidden;">
        ${bodyHTML}
      </div>
      ${footerHTML}
    </div>`;
}

async function renderA4PageToCanvas(pageHTML) {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '0';
  wrapper.style.left = '0';
  wrapper.style.transform = 'translateX(-300vw)';
  wrapper.style.width = `${A4_W_PX}px`;
  wrapper.style.background = '#ffffff';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.zIndex = '1';

  const container = document.createElement('div');
  container.style.width = `${A4_W_PX}px`;
  container.style.height = `${A4_H_PX}px`;
  container.style.background = '#ffffff';
  container.style.color = '#000000';
  container.style.fontFamily = "'Inter', Arial, sans-serif";
  container.innerHTML = pageHTML;

  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  const imgs = Array.from(container.querySelectorAll('img'));
  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(res => {
      img.onload = res;
      img.onerror = res;
      setTimeout(res, 3000);
    });
  }));

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  void container.offsetHeight;

  const canvas = await html2canvas(container, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    width: A4_W_PX,
    height: A4_H_PX,
    windowWidth: A4_W_PX,
    windowHeight: A4_H_PX,
    scrollX: 0,
    scrollY: 0,
    logging: false,
    onclone: (clonedDoc, clonedEl) => {
      clonedEl.style.position = 'static';
      clonedEl.style.transform = 'none';
      clonedEl.style.opacity = '1';
      clonedEl.style.visibility = 'visible';
      clonedEl.style.display = 'block';
      clonedEl.style.background = '#ffffff';
    }
  });

  wrapper.remove();
  return canvas;
}

async function paginateCutPlan(c, s) {
  const unitLabel = (c.unit || 'cm').toUpperCase();
  const dataObj = new Date(c.created_at);
  const dia = dataObj.getDate().toString().padStart(2, '0');
  const mesAno = dataObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const dataFormatada = `${dia} de ${mesAno.charAt(0).toUpperCase() + mesAno.slice(1)}`;
  const numCurto = c.number.split('-').pop();

  // Página 1 — cabeçalho completo
  const headerHTML = pdfHeaderBlock(s);
  const titleHTML = pdfDocTitleBlock(s, 'Plano de Corte', dataFormatada, numCurto);
  const metaHTML = pdfMetaBlock(`
    <div>
      <div><strong>Cliente:</strong> ${escapeHtml(c.client_name)}</div>
      <div style="margin-top:1mm;"><strong>Material:</strong> ${escapeHtml(c.material_padrao || '—')}</div>
    </div>
    <div style="font-weight:700; border:0.3mm solid #000; padding:1mm 2.5mm; border-radius:1mm;">Medidas em ${unitLabel}</div>
  `);

  // Páginas 2+ — cabeçalho compacto
  const compactHeaderHTML = pdfCompactHeaderBlock(s, 'Plano de Corte', numCurto, dataFormatada);
  const compactMetaHTML = pdfCompactMetaBlockCut(c, unitLabel);

  const theadHTML = pdfTableHeadCutPlan(unitLabel);
  const footerHTML = pdfFooterBlock(s);

  const hHeader = await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${headerHTML}</div>`);
  const hTitle = await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${titleHTML}</div>`);
  const hMeta = await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${metaHTML}</div>`);
  const hCompactHeader = await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${compactHeaderHTML}</div>`);
  const hCompactMeta = await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${compactMetaHTML}</div>`);
  const hThead = await measureBlockHeight(`<table style="width:100%; border-collapse:collapse;"><thead>${theadHTML.replace(/<\/?thead>/g, '')}</thead></table>`);
  const hFooter = await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${footerHTML}</div>`);

  const alturaPaginaUtil = A4_H_PX - A4_PAD_TOP_PX - A4_PAD_BOT_PX;
  const espacoP1 = alturaPaginaUtil - (hHeader + hTitle + hMeta + hThead + hFooter + 8);
  const espacoPn = alturaPaginaUtil - (hCompactHeader + hCompactMeta + hThead + hFooter + 8);

  // Mede cada linha com padding reduzido (2mm)
  const rowHeights = [];
  for (let i = 0; i < c.items.length; i++) {
    const rowHTML = `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8f9fa'}; border-bottom:0.2mm solid #eef2f6;">
        <td style="text-align:center; padding:2mm 1mm; font-weight:600;">${i + 1}</td>
        <td style="text-align:center; padding:2mm 1mm;">${c.items[i].qty || 1}</td>
        <td style="text-align:center; padding:2mm 1mm; white-space:nowrap;">${c.items[i].height}</td>
        <td style="text-align:center; padding:2mm 1mm; white-space:nowrap;">${c.items[i].width}</td>
        <td style="text-align:center; padding:2mm 1mm;">${buildFitaPDF(c.items[i])}</td>
      </tr>`;
    const h = await measureBlockHeight(`<table style="width:100%; border-collapse:collapse; table-layout:fixed;"><tbody>${rowHTML}</tbody></table>`);
    rowHeights.push(h);
  }

  const pages = [];
  let currentRows = [];
  let currentHeight = 0;
  let isFirstPage = true;

  for (let i = 0; i < c.items.length; i++) {
    const limit = isFirstPage ? espacoP1 : espacoPn;
    if (currentHeight + rowHeights[i] > limit && currentRows.length > 0) {
      pages.push(currentRows);
      currentRows = [];
      currentHeight = 0;
      isFirstPage = false;
    }
    currentRows.push(i);
    currentHeight += rowHeights[i];
  }
  if (currentRows.length > 0) pages.push(currentRows);

  return {
    pages,
    headerHTML, titleHTML, metaHTML,
    compactHeaderHTML, compactMetaHTML,
    theadHTML, footerHTML
  };
}

async function buildCutPlanPDF(c) {
  const s = getCompanyInfo();
  const pag = await paginateCutPlan(c, s);

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

  for (let p = 0; p < pag.pages.length; p++) {
    const rowsIdx = pag.pages[p];
    const isFirst = p === 0;

    const tbody = rowsIdx.map(i => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8f9fa'}; border-bottom:0.2mm solid #eef2f6;">
        <td style="text-align:center; padding:2mm 1mm; font-weight:600;">${i + 1}</td>
        <td style="text-align:center; padding:2mm 1mm;">${c.items[i].qty || 1}</td>
        <td style="text-align:center; padding:2mm 1mm; white-space:nowrap;">${c.items[i].height}</td>
        <td style="text-align:center; padding:2mm 1mm; white-space:nowrap;">${c.items[i].width}</td>
        <td style="text-align:center; padding:2mm 1mm;">${buildFitaPDF(c.items[i])}</td>
      </tr>`).join('');

    const bodyHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:9pt; table-layout:fixed;">
        ${pag.theadHTML}
        <tbody>${tbody}</tbody>
      </table>`;

    const pageHTML = isFirst
      ? buildA4Page(pag.headerHTML, pag.titleHTML + pag.metaHTML + bodyHTML, pag.footerHTML)
      : buildA4Page(pag.compactHeaderHTML, pag.compactMetaHTML + bodyHTML, pag.footerHTML);

    const canvas = await renderA4PageToCanvas(pageHTML);

    if (p > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_W_MM, A4_H_MM);
  }

  return pdf.output('blob');
}

async function buildBudgetPDF(b) {
  const s = getCompanyInfo();
  const dataObj = new Date(b.created_at);
  const dia = dataObj.getDate().toString().padStart(2, '0');
  const mesAno = dataObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const dataFormatada = `${dia} de ${mesAno.charAt(0).toUpperCase() + mesAno.slice(1)}`;
  const numCurto = b.number.split('-').pop();
  const conditions = (b.conditions || s.default_conditions || '').trim();

  // Página 1 — cabeçalho completo
  const headerHTML = pdfHeaderBlock(s);
  const titleHTML = pdfDocTitleBlock(s, 'Orçamento', dataFormatada, numCurto);
  const metaHTML = pdfMetaBlock(`<div><strong>Cliente:</strong> ${escapeHtml(b.client_name)}</div>`);

  // Páginas 2+ — cabeçalho compacto
  const compactHeaderHTML = pdfCompactHeaderBlock(s, 'Orçamento', numCurto, dataFormatada);
  const compactMetaHTML = pdfCompactMetaBlockBudget(b);

  const theadHTML = pdfTableHeadBudget();
  const footerHTML = pdfFooterBlock(s);

  const hHeader = await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${headerHTML}</div>`);
  const hTitle = await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${titleHTML}</div>`);
  const hMeta = await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${metaHTML}</div>`);
  const hCompactHeader = await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${compactHeaderHTML}</div>`);
  const hCompactMeta = await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${compactMetaHTML}</div>`);
  const hThead = await measureBlockHeight(`<table style="width:100%; border-collapse:collapse;"><thead>${theadHTML.replace(/<\/?thead>/g, '')}</thead></table>`);
  const hFooter = await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${footerHTML}</div>`);

  const alturaPaginaUtil = A4_H_PX - A4_PAD_TOP_PX - A4_PAD_BOT_PX;
  const espacoP1 = alturaPaginaUtil - (hHeader + hTitle + hMeta + hThead + hFooter + 8);
  const espacoPn = alturaPaginaUtil - (hCompactHeader + hCompactMeta + hThead + hFooter + 8);

  // Mede cada linha com padding reduzido (2mm)
  const rowHeights = [];
  for (let i = 0; i < b.items.length; i++) {
    const rowHTML = `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8f9fa'}; border-bottom:0.2mm solid #eef2f6;">
        <td style="text-align:center; padding:2mm 1mm; font-weight:600;">${i + 1}</td>
        <td style="padding:2mm 1mm; font-weight:500; word-break:break-word;">${escapeHtml(b.items[i].name)}</td>
        <td style="text-align:center; padding:2mm 1mm;">${b.items[i].qty}</td>
        <td style="text-align:right; padding:2mm 1mm; white-space:nowrap;">${formatCurrency(b.items[i].price)}</td>
        <td style="text-align:right; padding:2mm 1mm; font-weight:700; white-space:nowrap;">${formatCurrency(b.items[i].price * b.items[i].qty)}</td>
      </tr>`;
    const h = await measureBlockHeight(`<table style="width:100%; border-collapse:collapse; table-layout:fixed;"><tbody>${rowHTML}</tbody></table>`);
    rowHeights.push(h);
  }

  // Total + condições (última página)
  const totalHTML = `<div style="display:flex; justify-content:flex-end; margin-top:4mm;"><div style="background:#000000; color:#ffffff; padding:3mm 6mm; font-size:11pt; font-weight:600; border-radius:1mm;">${formatCurrency(b.total)}</div></div>`;
  const hTotal = await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${totalHTML}</div>`);
  const conditionsHTML = conditions
    ? `<div style="font-size:8pt; color:#000000; margin-top:4mm; padding-top:4mm; border-top:0.2mm solid #dddddd;"><strong style="color:#000000;">Observações:</strong><br>${escapeHtml(conditions)}</div>`
    : '';
  const hConditions = conditionsHTML ? await measureBlockHeight(`<div style="width:${A4_W_PX - 2 * A4_PAD_TOP_PX}px">${conditionsHTML}</div>`) : 0;

  const pages = [];
  let currentRows = [];
  let currentHeight = 0;
  let isFirstPage = true;

  for (let i = 0; i < b.items.length; i++) {
    const limit = isFirstPage ? espacoP1 : espacoPn;
    if (currentHeight + rowHeights[i] > limit && currentRows.length > 0) {
      pages.push(currentRows);
      currentRows = [];
      currentHeight = 0;
      isFirstPage = false;
    }
    currentRows.push(i);
    currentHeight += rowHeights[i];
  }
  if (currentRows.length > 0) pages.push(currentRows);

  // Garante total + conditions na última página
  const extraFinal = hTotal + hConditions + 4;
  while (pages.length > 0) {
    const last = pages[pages.length - 1];
    const usedInLast = last.reduce((sum, idx) => sum + rowHeights[idx], 0);
    if (usedInLast + extraFinal <= espacoPn) break;
    if (last.length <= 1) break;
    const moved = last.pop();
    pages.push([moved]);
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

  for (let p = 0; p < pages.length; p++) {
    const rowsIdx = pages[p];
    const isFirst = p === 0;
    const isLast = p === pages.length - 1;

    const tbody = rowsIdx.map(i => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8f9fa'}; border-bottom:0.2mm solid #eef2f6;">
        <td style="text-align:center; padding:2mm 1mm; font-weight:600;">${i + 1}</td>
        <td style="padding:2mm 1mm; font-weight:500; word-break:break-word;">${escapeHtml(b.items[i].name)}</td>
        <td style="text-align:center; padding:2mm 1mm;">${b.items[i].qty}</td>
        <td style="text-align:right; padding:2mm 1mm; white-space:nowrap;">${formatCurrency(b.items[i].price)}</td>
        <td style="text-align:right; padding:2mm 1mm; font-weight:700; white-space:nowrap;">${formatCurrency(b.items[i].price * b.items[i].qty)}</td>
      </tr>`).join('');

    const bodyHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:9pt; table-layout:fixed;">
        ${theadHTML}
        <tbody>${tbody}</tbody>
      </table>
      ${isLast ? totalHTML + conditionsHTML : ''}`;

    const pageHTML = isFirst
      ? buildA4Page(headerHTML, titleHTML + metaHTML + bodyHTML, footerHTML)
      : buildA4Page(compactHeaderHTML, compactMetaHTML + bodyHTML, footerHTML);

    const canvas = await renderA4PageToCanvas(pageHTML);

    if (p > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4_W_MM, A4_H_MM);
  }

  return pdf.output('blob');
}

async function generatePDFBlob(type, id) {
  try {
    await document.fonts.load('400 14px Inter');
    await document.fonts.load('500 14px Inter');
    await document.fonts.load('600 14px Inter');
    await document.fonts.load('700 14px Inter');
    await document.fonts.load('800 14px Inter');
    await document.fonts.ready;
  } catch (_) {}

  if (type === 'budget') {
    const b = window.db.budgets.find(x => x.id === id);
    if (!b) throw new Error('Orçamento não encontrado.');
    return buildBudgetPDF(b);
  } else if (type === 'cut') {
    const c = window.db.cuttingPlans.find(x => x.id === id);
    if (!c) throw new Error('Plano de Corte não encontrado.');
    return buildCutPlanPDF(c);
  }
  throw new Error('Tipo inválido.');
}

async function downloadPDF(type, id) {
  const loading = document.createElement('div');
  loading.className = 'pdf-loading';
  loading.innerHTML = `<div class="spinner"></div><span>Gerando PDF A4...</span>`;
  document.body.appendChild(loading);

  try {
    const blob = await generatePDFBlob(type, id);
    const doc = type === 'budget'
      ? window.db.budgets.find(x => x.id === id)
      : window.db.cuttingPlans.find(x => x.id === id);
    const nameToUse = type === 'budget' ? doc.number : (doc.name || doc.number);
    const safeName = String(nameToUse).replace(/[\\/:*?"<>|]/g, '_').trim();
    const fileName = `${type === 'budget' ? 'Orcamento' : 'PlanoCorte'}-${safeName}.pdf`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    showToast('PDF A4 gerado com sucesso!', 'success');
  } catch (err) {
    console.error('Erro em downloadPDF:', err);
    showToast('Erro ao gerar PDF.', 'error');
  } finally {
    loading.remove();
  }
}

async function sharePDFWhatsApp(type, id) {
  const loading = document.createElement('div');
  loading.className = 'pdf-loading';
  loading.innerHTML = `<div class="spinner"></div><span>Preparando PDF A4...</span>`;
  document.body.appendChild(loading);

  try {
    const s = getCompanyInfo();
    const doc = type === 'budget'
      ? window.db.budgets.find(x => x.id === id)
      : window.db.cuttingPlans.find(x => x.id === id);
    if (!doc) { showToast('Documento não encontrado.', 'error'); return; }

    const blob = await generatePDFBlob(type, id);
    const nameToUse = type === 'budget' ? doc.number : (doc.name || doc.number);
    const safeName = String(nameToUse).replace(/[\\/:*?"<>|]/g, '_').trim();
    const fileName = `${type === 'budget' ? 'Orcamento' : 'PlanoCorte'}-${safeName}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });

    let phone = (s.whatsapp || '').replace(/\D/g, '');
    if (phone && !phone.startsWith('55')) phone = '55' + phone;
    if (phone.length > 13) phone = phone.slice(0, 13);

    const title = type === 'budget' ? 'orçamento' : 'plano de corte';
    const mensagem = `Olá! Segue em anexo o ${title} *${nameToUse}* da *${s.company_name}*.`;
    const waURL = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${type === 'budget' ? 'Orçamento' : 'Plano de Corte'} ${nameToUse}`, text: mensagem });
        showToast('PDF compartilhado!', 'success');
        return;
      } catch (shareErr) {
        if (shareErr && shareErr.name === 'AbortError') return;
      }
    }

    showToast('PDF baixado! Abrindo WhatsApp...', 'success');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setTimeout(() => window.open(waURL, '_blank'), 800);
  } catch (err) {
    console.error('Erro em sharePDFWhatsApp:', err);
    showToast('Erro ao gerar/compartilhar PDF.', 'error');
  } finally {
    loading.remove();
  }
}

// ============================================================
// AÇÕES DE SALVAR (SUPABASE)
// ============================================================
async function saveCutPlan() {
  if (!cutState.name.trim()) { showToast('Informe um nome para o projeto.', 'error'); return; }
  const validItems = cutState.items.filter(i => i.height && i.width);
  if (validItems.length === 0) { showToast('Preencha pelo menos uma peça com altura e largura.', 'error'); return; }
  
  const user = window.db.users.find(u => u.id === window.currentUser.id);
  const maxSeq = window.db.cuttingPlans.reduce((max, p) => {
    const m = /(\d+)\s*$/.exec(p.number || '');
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  let seq = Math.max(maxSeq, window.db.cuttingPlans.length) + 1;

  const basePlan = {
    name: cutState.name, client_id: window.currentUser.id, client_name: user ? user.name : window.currentUser.name,
    items: validItems.map(i => ({ ...i })), unit: cutState.unit, material_padrao: cutState.materialPadrao, status: 'pending', created_at: new Date().toISOString()
  };

  let error = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    const number = 'PC-2026-' + String(seq).padStart(4, '0');
    ({ error } = await supabaseClient.from('cutting_plans').insert([{ number, ...basePlan }]));
    const isDuplicate = error && (error.code === '23505' || /duplicate|unique/i.test(error.message || ''));
    if (!isDuplicate) break;
    seq++;
  }
  if (error) { console.error('Erro ao salvar plano de corte:', error); showToast('Erro ao salvar no banco: ' + (error.message || 'desconhecido'), 'error'); } 
  else { await loadDB(); closeModal(); renderApp(); showToast('Plano de corte salvo!', 'success'); }
}

async function updateCutPlan() {
  if (!cutState.name.trim()) { showToast('Informe um nome para o projeto.', 'error'); return; }
  const validItems = cutState.items.filter(i => i.height && i.width);
  if (validItems.length === 0) { showToast('Preencha pelo menos uma peça com altura e largura.', 'error'); return; }

  const c = window.db.cuttingPlans.find(x => x.id === cutState.editId);
  if (!c) { showToast('Plano não encontrado.', 'error'); return; }
  if (c.status !== 'pending') { showToast('Este plano não pode mais ser editado.', 'warning'); return; }

  const updatedCutPlan = { name: cutState.name, items: validItems.map(i => ({ ...i })), unit: cutState.unit, material_padrao: cutState.materialPadrao };
  const { error } = await supabaseClient.from('cutting_plans').update(updatedCutPlan).eq('id', c.id);
  if (error) { console.error('Erro ao atualizar plano de corte:', error); showToast('Erro ao atualizar: ' + (error.message || 'desconhecido'), 'error'); } 
  else { await loadDB(); closeModal(); renderApp(); showToast('Plano de corte atualizado!', 'success'); }
}

async function saveBudget() {
  if (budgetState.cart.length === 0) { showToast('Adicione itens ao carrinho.', 'error'); return; }
  const total = budgetState.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const user = window.db.users.find(u => u.id === window.currentUser.id);
  const seq = window.db.budgets.length + 1;
  const number = (window.db.settings.number_prefix || 'MP-2026-') + String(seq).padStart(4, '0');

  const newBudget = {
    number, client_id: window.currentUser.id, client_name: user ? user.name : window.currentUser.name,
    items: budgetState.cart.map(i => ({ ...i })), total, status: 'pending', conditions: window.db.settings.default_conditions || '', created_at: new Date().toISOString()
  };

  const { error } = await supabaseClient.from('budgets').insert([newBudget]);
  if (error) { showToast('Erro ao salvar no banco.', 'error'); } 
  else { await loadDB(); closeModal(); renderApp(); showToast('Orçamento criado com sucesso!', 'success'); }
}

async function updateBudget() {
  if (budgetState.cart.length === 0) { showToast('Adicione itens ao carrinho.', 'error'); return; }
  const b = window.db.budgets.find(x => x.id === budgetState.editId);
  if (!b) { showToast('Orçamento não encontrado.', 'error'); return; }
  if (b.status !== 'pending') { showToast('Este orçamento não pode mais ser editado.', 'warning'); return; }

  const updatedBudget = { items: budgetState.cart.map(i => ({ ...i })), total: budgetState.cart.reduce((s, i) => s + i.price * i.qty, 0), updated_at: new Date().toISOString() };
  const { error } = await supabaseClient.from('budgets').update(updatedBudget).eq('id', b.id);
  if (error) { showToast('Erro ao atualizar.', 'error'); } 
  else { await loadDB(); closeModal(); renderApp(); showToast('Orçamento atualizado!', 'success'); }
}

async function saveClient() {
  const name = document.getElementById('cl-name')?.value.trim();
  const email = document.getElementById('cl-email')?.value.trim();
  const document_ = document.getElementById('cl-document')?.value.trim();
  const phone = document.getElementById('cl-phone')?.value.trim();
  const id = document.getElementById('cl-id')?.value;

  if (!name || !email) { showToast('Nome e e-mail são obrigatórios.', 'error'); return; }

  if (!id) {
    const password = document.getElementById('cl-password')?.value;
    if (!password || password.length < 4) { showToast('Senha mínima de 4 caracteres.', 'error'); return; }
    const { error } = await supabaseClient.from('users').insert([{ type: 'client', name, email, document: document_, phone, password, active: true, created_at: new Date().toISOString() }]);
    if (error) { showToast('Erro ao cadastrar.', 'error'); return; }
    showToast('Cliente cadastrado!', 'success');
  } else {
    const { error } = await supabaseClient.from('users').update({name, email, document: document_, phone}).eq('id', id);
    if (error) { showToast('Erro ao atualizar.', 'error'); return; }
    showToast('Cliente atualizado!', 'success');
  }
  await loadDB(); closeModal(); renderApp();
}

async function saveMaterial() {
  const name = document.getElementById('mat-name')?.value.trim();
  const description = document.getElementById('mat-desc')?.value.trim();
  const price = parseFloat(document.getElementById('mat-price')?.value);
  const unit = document.getElementById('mat-unit')?.value.trim() || 'un';
  const category = document.getElementById('mat-category')?.value;
  const id = document.getElementById('mat-id')?.value;

  if (!name || isNaN(price) || price < 0) { showToast('Nome e preço válidos são obrigatórios.', 'error'); return; }

  if (!id) {
    const { error } = await supabaseClient.from('materials').insert([{ name, description, price, unit, category, active: true }]);
    if (error) { showToast('Erro ao cadastrar.', 'error'); return; }
    showToast('Material cadastrado!', 'success');
  } else {
    const { error } = await supabaseClient.from('materials').update({ name, description, price, unit, category }).eq('id', id);
    if (error) { showToast('Erro ao atualizar.', 'error'); return; }
    showToast('Material atualizado!', 'success');
  }
  await loadDB(); closeModal(); renderApp();
}

async function saveSettings() {
  const s = window.db.settings;
  const updatedSettings = {
    company_name: document.getElementById('cfg-companyName')?.value || s.company_name,
    cnpj: document.getElementById('cfg-cnpj')?.value || s.cnpj,
    whatsapp: (document.getElementById('cfg-whatsapp')?.value || '').replace(/\D/g, ''),
    whatsapp2: (document.getElementById('cfg-whatsapp2')?.value || '').replace(/\D/g, ''),
    email: document.getElementById('cfg-email')?.value || s.email,
    address: document.getElementById('cfg-address')?.value || s.address,
    number_prefix: document.getElementById('cfg-numberPrefix')?.value || s.number_prefix,
    default_conditions: document.getElementById('cfg-defaultConditions')?.value || '',
    logo: s.logo || null
  };

  const { error } = await supabaseClient.from('settings').update(updatedSettings).eq('id', 1);
  if (error) { showToast('Erro ao salvar configurações.', 'error'); } 
  else { await loadDB(); renderApp(); showToast('Configurações salvas!', 'success'); }
}

function openClientModal(clientId = null) {
  const c = clientId ? window.db.users.find(u => u.id === clientId) : null;
  openModal(c ? 'Editar Cliente' : 'Novo Cliente', `
    <div class="flex flex-col gap-1">
      <input type="hidden" id="cl-id" value="${c ? c.id : ''}">
      <div><label class="label">Nome</label><input class="input" id="cl-name" value="${c ? escapeHtml(c.name) : ''}"></div>
      <div><label class="label">E-mail</label><input class="input" id="cl-email" type="email" value="${c ? escapeHtml(c.email) : ''}"></div>
      <div><label class="label">CPF/CNPJ</label><input class="input" id="cl-document" value="${c ? escapeHtml(c.document || '') : ''}"></div>
      <div><label class="label">Telefone</label><input class="input" id="cl-phone" value="${c ? escapeHtml(c.phone || '') : ''}"></div>
      ${!c ? '<div><label class="label">Senha</label><input class="input" id="cl-password" type="password" placeholder="Senha de acesso"></div>' : ''}
      <button type="button" class="btn btn-primary mt-1" data-action="save-client"><i data-lucide="save"></i> Salvar</button>
    </div>`);
}

function openMaterialModal(materialId = null) {
  const m = materialId ? window.db.materials.find(x => x.id === materialId) : null;
  const categories = ["MDFs", "Fitas", "Ferragens", "Puxadores", "Outros"];
  openModal(m ? 'Editar Material' : 'Novo Material', `
    <div class="flex flex-col gap-1">
      <input type="hidden" id="mat-id" value="${m ? m.id : ''}">
      <div><label class="label">Nome</label><input class="input" id="mat-name" value="${m ? escapeHtml(m.name) : ''}"></div>
      <div><label class="label">Descrição</label><input class="input" id="mat-desc" value="${m ? escapeHtml(m.description || '') : ''}"></div>
      <div><label class="label">Preço (R$)</label><input class="input" id="mat-price" type="number" step="0.01" min="0" value="${m ? m.price : ''}"></div>
      <div><label class="label">Unidade (un, m, m², pct)</label><input class="input" id="mat-unit" value="${m ? escapeHtml(m.unit) : 'un'}"></div>
      <div>
        <label class="label">Categoria</label>
        <select class="select" id="mat-category">
          ${categories.map(c => `<option value="${c}" ${m && m.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <button type="button" class="btn btn-primary mt-1" data-action="save-material"><i data-lucide="save"></i> Salvar</button>
    </div>`);
}

// ============================================================
// EVENTOS DE CLIQUE
// ============================================================
document.addEventListener('click', async (e) => {
  const overlay = e.target.closest('.modal-overlay');
  if (overlay && e.target === overlay) { closeModal(); return; }
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'logout') { sessionStorage.removeItem('madprime_user'); window.location.href = 'index.html'; return; }
  if (action === 'navigate') { navigate(target.dataset.page); return; }
  if (action === 'close-modal') { closeModal(); return; }

  if (action === 'filter-materials') { materialFilter = target.dataset.cat; renderApp(); return; }

  if (action === 'new-client') { openClientModal(); return; }
  if (action === 'edit-client') { openClientModal(target.dataset.id); return; }
  if (action === 'new-material') { openMaterialModal(); return; }
  if (action === 'edit-material') { openMaterialModal(target.dataset.id); return; }
  if (action === 'new-cut-plan') { openNewCutPlanModal(); return; }
  if (action === 'edit-cut-plan') { openEditCutPlanModal(target.dataset.id); return; }
  if (action === 'view-cut-plan') { openCutPlanViewModal(target.dataset.id); return; }
  if (action === 'new-budget') { openNewBudgetModal(); return; }
  if (action === 'edit-budget') { openEditBudgetModal(target.dataset.id); return; }
  if (action === 'view-budget') { openBudgetViewModal(target.dataset.id); return; }
  
  if (action === 'save-client') { saveClient(); return; }
  if (action === 'save-material') { saveMaterial(); return; }
  if (action === 'save-cut-plan') { 
    const nameInput = document.getElementById('cut-name-input'); 
    if (nameInput) cutState.name = nameInput.value; 
    saveCutPlan(); return; 
  }
  if (action === 'update-cut-plan') { 
    const nameInput = document.getElementById('cut-name-input'); 
    if (nameInput) cutState.name = nameInput.value; 
    updateCutPlan(); return; 
  }
  if (action === 'save-budget') { saveBudget(); return; }
  if (action === 'update-budget') { updateBudget(); return; }
  if (action === 'save-settings') { saveSettings(); return; }

  if (action === 'pdf-cut-plan') { downloadPDF('cut', target.dataset.id); return; }
  if (action === 'share-cut-plan-whatsapp') { sharePDFWhatsApp('cut', target.dataset.id); return; }
  if (action === 'pdf-budget') { downloadPDF('budget', target.dataset.id); return; }
  if (action === 'share-pdf-whatsapp') { sharePDFWhatsApp('budget', target.dataset.id); return; }

  if (action === 'approve-cut-plan') {
    await supabaseClient.from('cutting_plans').update({status: 'approved'}).eq('id', target.dataset.id); 
    await loadDB(); renderApp(); showToast('Plano aprovado!', 'success'); return;
  }
  if (action === 'refuse-cut-plan') {
    await supabaseClient.from('cutting_plans').update({status: 'refused'}).eq('id', target.dataset.id); 
    await loadDB(); renderApp(); showToast('Plano recusado.', 'warning'); return;
  }
  if (action === 'delete-cut-plan') {
    if (!confirm('Excluir este plano de corte?')) return;
    await supabaseClient.from('cutting_plans').delete().eq('id', target.dataset.id); 
    await loadDB(); renderApp(); showToast('Plano excluído.', 'info'); return;
  }
  if (action === 'approve-budget') {
    await supabaseClient.from('budgets').update({status: 'approved'}).eq('id', target.dataset.id); 
    await loadDB(); renderApp(); showToast('Orçamento aprovado!', 'success'); return;
  }
  if (action === 'refuse-budget') {
    await supabaseClient.from('budgets').update({status: 'refused'}).eq('id', target.dataset.id); 
    await loadDB(); renderApp(); showToast('Orçamento recusado.', 'warning'); return;
  }
  if (action === 'delete-budget') {
    if (!confirm('Excluir este orçamento?')) return;
    await supabaseClient.from('budgets').delete().eq('id', target.dataset.id); 
    await loadDB(); renderApp(); showToast('Orçamento excluído.', 'info'); return;
  }
  if (action === 'delete-client') {
    if (!confirm('Excluir cliente?')) return;
    await supabaseClient.from('users').delete().eq('id', target.dataset.id); 
    await loadDB(); renderApp(); showToast('Cliente excluído.', 'info'); return;
  }
  if (action === 'delete-material') {
    if (!confirm('Excluir material?')) return;
    await supabaseClient.from('materials').delete().eq('id', target.dataset.id); 
    await loadDB(); renderApp(); showToast('Material excluído.', 'info'); return;
  }
  if (action === 'toggle-client') {
    const c = window.db.users.find(x => x.id === target.dataset.id);
    if (c) { await supabaseClient.from('users').update({active: !c.active}).eq('id', c.id); await loadDB(); renderApp(); }
    return;
  }
  if (action === 'toggle-material') {
    const m = window.db.materials.find(x => x.id === target.dataset.id);
    if (m) { await supabaseClient.from('materials').update({active: !m.active}).eq('id', m.id); await loadDB(); renderApp(); }
    return;
  }

  if (action === 'budget-tab') {
    budgetState.mobileTab = target.dataset.tab;
    document.querySelectorAll('.budget-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === budgetState.mobileTab));
    document.querySelector('.catalog-panel').classList.toggle('active', budgetState.mobileTab === 'catalog');
    document.querySelector('.cart-panel').classList.toggle('active', budgetState.mobileTab === 'cart');
    return;
  }
  if (action === 'catalog-category') {
    budgetState.category = target.dataset.cat;
    document.querySelectorAll('.cat-chip').forEach(chip => chip.classList.toggle('active', chip.dataset.cat === budgetState.category));
    refreshCatalog(); return;
  }
  if (action === 'clear-catalog-search') {
    budgetState.search = ''; 
    renderBudgetModal(); return;
  }
  if (action === 'add-to-cart') {
    const mat = window.db.materials.find(m => m.id === target.dataset.id);
    if (!mat) return;
    const existing = budgetState.cart.find(i => i.materialId === mat.id);
    if (existing) existing.qty++;
    else budgetState.cart.push({ materialId: mat.id, name: mat.name, price: mat.price, qty: 1 });
    refreshCart(); refreshCatalog(); showToast('Produto adicionado!', 'success'); return;
  }
  if (action === 'inc-qty') {
    const idx = parseInt(target.dataset.idx);
    if (budgetState.cart[idx]) { budgetState.cart[idx].qty++; refreshCart(); refreshCatalog(); } return;
  }
  if (action === 'dec-qty') {
    const idx = parseInt(target.dataset.idx);
    if (budgetState.cart[idx]) {
      if (budgetState.cart[idx].qty > 1) budgetState.cart[idx].qty--;
      else budgetState.cart.splice(idx, 1);
      refreshCart(); refreshCatalog();
    } return;
  }
  if (action === 'remove-cart-item') {
    const idx = parseInt(target.dataset.idx);
    if (budgetState.cart[idx]) { budgetState.cart.splice(idx, 1); refreshCart(); refreshCatalog(); } return;
  }
  if (action === 'add-free-item') {
    const desc = document.getElementById('free-item-desc')?.value.trim();
    const val = parseFloat(document.getElementById('free-item-value')?.value);
    if (!desc) { showToast('Informe a descrição.', 'error'); return; }
    if (isNaN(val) || val <= 0) { showToast('Informe um valor válido.', 'error'); return; }
    budgetState.cart.push({ materialId: null, name: 'Item livre: ' + desc, price: val, qty: 1 });
    document.getElementById('free-item-desc').value = '';
    document.getElementById('free-item-value').value = '';
    refreshCart(); showToast('Item adicionado.', 'success'); return;
  }

  if (action === 'clear-cut-item') {
    const idx = parseInt(target.dataset.idx);
    if (cutState.items[idx]) {
      cutState.items[idx] = { id: uid('item'), qty: '', height: '', width: '', top: false, bottom: false, left: false, right: false, obs: '' };
      renderCutPlanModal();
    } return;
  }
  if (action === 'toggle-edge') {
    const idx = parseInt(target.dataset.idx);
    const edge = target.dataset.edge;
    if (cutState.items[idx]) {
      cutState.items[idx][edge] = !cutState.items[idx][edge];
      document.querySelectorAll(`[data-action="toggle-edge"][data-idx="${idx}"][data-edge="${edge}"]`).forEach(btn => btn.classList.toggle('active', cutState.items[idx][edge]));
    } return;
  }
  if (action === 'set-unit') {
    cutState.unit = target.dataset.unit;
    document.querySelectorAll('.unit-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.unit === cutState.unit));
    document.querySelectorAll('th')[2].textContent = `Alt. (${cutState.unit})`;
    document.querySelectorAll('th')[3].textContent = `Larg. (${cutState.unit})`;
    return;
  }
});

// Evento de digitação
document.addEventListener('input', (e) => {
  if (e.target.dataset.cutField) {
    const idx = parseInt(e.target.dataset.idx);
    if (cutState.items[idx]) cutState.items[idx][e.target.dataset.cutField] = e.target.value;
  }
  if (e.target.id === 'cut-name-input') cutState.name = e.target.value;
  
  if (e.target.id === 'catalog-search-input') {
    budgetState.search = e.target.value;
    refreshCatalog();
    const box = e.target.closest('.search-box');
    const existingClear = box?.querySelector('.clear-search');
    if (e.target.value && !existingClear) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'clear-search'; btn.dataset.action = 'clear-catalog-search'; btn.innerHTML = '<i data-lucide="x"></i>';
      box.appendChild(btn); lucide.createIcons();
    } else if (!e.target.value && existingClear) { existingClear.remove(); }
    return;
  }
});

// Upload da Logo
document.addEventListener('change', (e) => {
  if (e.target.id === 'cfg-logo') {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { window.db.settings.logo = ev.target.result; showToast('Logo carregada! Salve para confirmar.', 'info'); };
    reader.readAsDataURL(file);
  }
  if (e.target.dataset.action === 'set-material') {
    cutState.materialPadrao = e.target.value;
  }
});
