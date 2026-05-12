import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Menu, BookOpen, Clock, FileStack, LayoutGrid, List, RotateCw } from 'lucide-react';
import { clsx } from 'clsx';
import AdminSidebar from '../components/AdminSidebar';
import { apiFetch } from '../lib/api';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AlertModal } from '../components/ui/AlertModal';

const AdminSubjectsPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // UI States
  const [alert, setAlert] = useState<{ show: boolean, title: string, message: string, variant: 'success' | 'error' | 'info' }>({
    show: false, title: '', message: '', variant: 'info'
  });
  const [confirm, setConfirm] = useState<{ show: boolean, id: string | null }>({
    show: false, id: null
  });

  const fetchSubjects = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      const res = await apiFetch('/hq-management/subjects', { token });
      setSubjects(res.subjects || []);
    } catch (err) {

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleDeleteClick = (id: string) => {
    setConfirm({ show: true, id });
  };

  const handleConfirmDelete = async () => {
    const id = confirm.id;
    if (!id) return;

    try {
      await apiFetch(`/hq-management/subjects/${id}`, {
        method: 'DELETE',
        token: localStorage.getItem('admin_token')!
      });
      setConfirm({ show: false, id: null });
      fetchSubjects();
    } catch (err: any) {

      setAlert({
        show: true,
        title: 'Delete Failed',
        message: err.message || 'Could not delete the subject. Make sure it has no active papers or dependencies.',
        variant: 'error'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const token = localStorage.getItem('admin_token')!;
    
    const name = fd.get('name') as string;
    const code = fd.get('code') as string;
    if (!name || !code) return;

    // Duplicate Check
    const isDuplicate = subjects.some(s => s.code.toLowerCase() === code.toLowerCase() && s.id !== editingSubject?.id);
    if (isDuplicate) {
      setAlert({
        show: true,
        title: 'Subject Already Exists',
        message: `The subject code "${code.toUpperCase()}" is already registered in your catalogue. Please check the existing subjects or use a different code.`,
        variant: 'info'
      });
      return;
    }

    setSaving(true);
    try {
      if (editingSubject) {
        await apiFetch(`/hq-management/subjects/${editingSubject.id}`, {
          method: 'PATCH',
          body: { name: fd.get('name'), code: fd.get('code') },
          token
        });
      } else {
        await apiFetch('/hq-management/subjects', {
          method: 'POST',
          body: { name: fd.get('name'), code: fd.get('code') },
          token
        });
      }
      setShowModal(false);
      setEditingSubject(null);
      fetchSubjects();
    } catch (err: any) {

      setAlert({
        show: true,
        title: 'Save Failed',
        message: err.message || 'Failed to save subject. Please check if the subject code already exists.',
        variant: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (subject: any) => {
    setEditingSubject(subject);
    setShowModal(true);
  };

  const filteredSubjects = subjects.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.code.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen bg-transparent flex font-sans">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col lg:ml-64">
        <header className="sticky top-0 z-20 bg-transparent/80 backdrop-blur-xl border-b border-theme-border px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl bg-theme-surface text-theme-secondary">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-theme-primary">Subjects</h1>
          </div>
          <button 
            onClick={() => fetchSubjects()} 
            className="p-2 rounded-xl bg-theme-surface hover:bg-theme-surface-2 text-theme-muted transition-colors group"
            title="Refresh Data"
          >
            <RotateCw className="w-5 h-5 group-active:rotate-180 transition-transform duration-500" />
          </button>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h1 className="text-3xl font-bold text-theme-primary mb-2">Subject Catalogue</h1>
              <p className="text-theme-muted">Organize and manage the curriculum subjects for the platform.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter subjects..." 
                  className="w-full sm:w-64 bg-theme-surface border border-theme-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-theme-primary focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>
              <button 
                onClick={() => { setEditingSubject(null); setShowModal(true); }}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all font-semibold shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" />
                Add Subject
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex bg-theme-surface p-1 rounded-xl border border-theme-border">
              <button 
                onClick={() => setViewMode('grid')}
                className={clsx(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'grid' ? "bg-indigo-500/10 text-indigo-400" : "text-theme-muted hover:text-theme-secondary"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={clsx(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'table' ? "bg-indigo-500/10 text-indigo-400" : "text-theme-muted hover:text-theme-secondary"
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-theme-muted">{filteredSubjects.length} subjects found</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-theme-muted font-medium">Loading subjects...</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredSubjects.map((subject) => (
                <div key={subject.id} className="glass-card group p-6 border-theme-border hover:border-indigo-500/30 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button onClick={() => openEditModal(subject)} className="p-2 rounded-lg bg-theme-surface/80 border border-theme-border text-theme-secondary hover:text-indigo-400 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteClick(subject.id)} className="p-2 rounded-lg bg-theme-surface/80 border border-theme-border text-theme-secondary hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <BookOpen className="w-7 h-7 text-indigo-400" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 mb-1 inline-block">
                        {subject.code}
                      </span>
                      <h3 className="text-xl font-bold text-theme-primary leading-tight line-clamp-1">{subject.name}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-theme-surface/50 rounded-xl p-3 border border-theme-border">
                      <div className="flex items-center gap-2 text-theme-muted mb-1">
                        <FileStack className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold uppercase">Papers</span>
                      </div>
                      <p className="text-lg font-bold text-theme-primary">{subject.count || 0}</p>
                    </div>
                    <div className="bg-theme-surface/50 rounded-xl p-3 border border-theme-border">
                      <div className="flex items-center gap-2 text-theme-muted mb-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold uppercase">Added</span>
                      </div>
                      <p className="text-xs font-bold text-theme-primary">{new Date(subject.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card overflow-hidden border-theme-border">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-theme-border text-xs text-theme-muted uppercase tracking-wider">
                      <th className="px-6 py-4 font-semibold">Subject</th>
                      <th className="px-6 py-4 font-semibold">Code</th>
                      <th className="px-6 py-4 font-semibold text-center">Papers</th>
                      <th className="px-6 py-4 font-semibold">Created</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubjects.map((subject) => (
                      <tr key={subject.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-theme-primary">{subject.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20 uppercase">
                            {subject.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm text-theme-secondary font-medium">{subject.count || 0}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-theme-muted">
                          {new Date(subject.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEditModal(subject)} className="p-2 rounded-lg bg-theme-surface hover:bg-theme-surface-2 text-theme-muted hover:text-indigo-400 transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteClick(subject.id)} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add/Edit Subject Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-8 border-theme-border relative">
            <h2 className="text-2xl font-bold text-theme-primary mb-1">{editingSubject ? 'Edit Subject' : 'Add New Subject'}</h2>
            <p className="text-theme-muted text-sm mb-8">{editingSubject ? 'Update the details for this course.' : 'Define a new subject for the platform catalogue.'}</p>
            
            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-theme-muted ml-1">Subject Name</label>
                <input 
                  name="name" 
                  type="text" 
                  required 
                  defaultValue={editingSubject?.name || ''}
                  className="bg-theme-surface border border-theme-border rounded-xl px-4 py-3 text-theme-primary focus:outline-none focus:border-indigo-500/50" 
                  placeholder="e.g. Microeconomics" 
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-theme-muted ml-1">Course Code</label>
                <input 
                  name="code" 
                  type="text" 
                  required 
                  defaultValue={editingSubject?.code || ''}
                  className="bg-theme-surface border border-theme-border rounded-xl px-4 py-3 text-theme-primary uppercase font-mono focus:outline-none focus:border-indigo-500/50" 
                  placeholder="e.g. ECON201" 
                />
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-theme-border">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 rounded-xl text-theme-secondary font-semibold hover:bg-theme-surface transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-8 py-2.5 rounded-xl text-white bg-indigo-500 hover:bg-indigo-600 font-bold shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {saving && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                  {editingSubject ? 'Update Subject' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Custom UI Modals ── */}
      <ConfirmModal 
        isOpen={confirm.show}
        onClose={() => setConfirm({ show: false, id: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Subject"
        message="Are you sure you want to delete this subject? This will permanently remove the subject and all papers linked to it from the database."
        confirmText="Delete Permanently"
        variant="danger"
      />

      <AlertModal 
        isOpen={alert.show}
        onClose={() => setAlert({ ...alert, show: false })}
        title={alert.title}
        message={alert.message}
        variant={alert.variant}
      />
    </div>
  );
};

export default AdminSubjectsPage;
