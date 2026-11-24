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

function ensurePdfPageBreak(doc, currentY, neededHeight, pageHeight = 297, marginTop = 15, marginBottom = 15) {
  const usableBottom = pageHeight - marginBottom;
  if (currentY + neededHeight > usableBottom) {
    if (doc && typeof doc.addPage === 'function') doc.addPage();
    return marginTop;
  }
  return currentY;
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
          <div class="flex items-center justify-between" style="padding:0.5rem 0; border-bottom:1px solid var(--border); break-inside: avoid; page-break-inside: avoid;">
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
      <div class="card mb-1" style="padding:1rem; break-inside: avoid; page-break-inside: avoid;">
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
      <div class="card mb-1" style="padding:1rem; break-inside: avoid; page-break-inside: avoid;">
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
        <div class="list-item" style="break-inside: avoid; page-break-inside: avoid;">
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
        <div class="list-item" style="break-inside: avoid; page-break-inside: avoid;">
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
    <tr data-cut-row="${idx}" style="${isEmpty ? 'background: rgba(255,255,255,0.02);' : ''} break-inside: avoid; page-break-inside: avoid;">
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
      <div style="border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; break-inside: avoid; page-break-inside: avoid;">
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
    <div style="border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 0.6rem; display: flex; justify-content: space-between; align-items: center; break-inside: avoid; page-break-inside: avoid;">
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
      <div style="padding-right: 5px;">
        ${itemsHtml}
      </div>
      
      <div style="background:var(--card); border:1px solid var(--border); border-radius:var(--radius-sm); padding:1rem; margin-top:1rem; display:flex; justify-content:space-between; align-items:center; break-inside: avoid; page-break-inside: avoid;">
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
